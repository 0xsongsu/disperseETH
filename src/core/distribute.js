const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { networks, paths, transaction } = require('../utils/config');
const { readFileLines } = require('../utils/helpers');
const { exec } = require('child_process');
const Logger = require('../utils/logger');

// 参数
const amountPerAddress = process.env.DISTRIBUTION_AMOUNT || 0.2;
const addressGroupSize = parseInt(process.env.GROUP_SIZE) || 4;

function getAddressGroups() {
    const addresses = readFileLines(path.join(paths.data, 'address.txt'));
    
    // 钱包地址分组
    const groups = [];
    for (let i = 0; i < addresses.length; i += addressGroupSize) {
        const group = addresses.slice(i, Math.min(i + addressGroupSize, addresses.length));
        if (group.length > 0) {
            groups.push(group);
        }
    }
    
    groups.forEach((group, index) => {
        Logger.info(`第 ${index + 1} 组地址数量: ${group.length}`);
    });
    
    return groups;
}

function getPrivateKeys() {
    const keys = readFileLines(path.join(paths.data, 'pk.txt'));
    return keys;
}

function saveFailedDistribution(privateKey, recipients, error) {
    try {
        // 确保logs目录存在
        if (!fs.existsSync(paths.logs)) {
            fs.mkdirSync(paths.logs, { recursive: true });
        }

        const failedKeysPath = path.join(paths.logs, 'failed_distribute_keys.txt');
        const failedAddressesPath = path.join(paths.logs, 'failed_distribute_addresses.txt');
        const failedLogsPath = path.join(paths.logs, 'failed_distribute_logs.txt');

        // 保存失败的私钥
        fs.appendFileSync(failedKeysPath, privateKey + '\n');

        // 保存失败的接收地址组
        fs.appendFileSync(failedAddressesPath, recipients.join('\n') + '\n---\n');

        // 保存失败日志
        const logEntry = `时间: ${new Date().toISOString()}\n` +
            `钱包: ${new ethers.Wallet(privateKey).address}\n` +
            `错误: ${error}\n` +
            `接收地址: ${recipients.join(', ')}\n` +
            '----------------------------------------\n';
        fs.appendFileSync(failedLogsPath, logEntry);

        Logger.info('失败记录已保存');
    } catch (error) {
        Logger.error(`保存失败记录时出错: ${error.message}`);
    }
}

async function retryFailedDistributions(amountPerAddress) {
    try {
        const failedKeysPath = path.join(paths.logs, 'failed_distribute_keys.txt');
        const failedAddressesPath = path.join(paths.logs, 'failed_distribute_addresses.txt');

        // 检查是否存在失败记录
        if (!fs.existsSync(failedKeysPath) || !fs.existsSync(failedAddressesPath)) {
            Logger.warning('没有找到失败记录');
            return;
        }

        // 读取失败的私钥和地址组
        const failedKeys = readFileLines(failedKeysPath);
        const addressesContent = fs.readFileSync(failedAddressesPath, 'utf8');
        const addressGroups = addressesContent.split('---\n')
            .filter(group => group.trim())
            .map(group => group.trim().split('\n').filter(addr => addr.trim()));

        if (failedKeys.length === 0 || addressGroups.length === 0) {
            Logger.info('没有需要重试的交易');
            return;
        }

        if (failedKeys.length !== addressGroups.length) {
            throw new Error('私钥数量与地址组数量不匹配');
        }

        Logger.title('开始重试失败的分发任务');
        Logger.info(`找到 ${failedKeys.length} 个失败记录`);
        Logger.info(`每个地址将收到 ${Logger.amount(amountPerAddress)} ETH`);
        Logger.divider();

        for (let i = 0; i < failedKeys.length; i++) {
            const result = await deployAndDistribute(
                failedKeys[i],
                addressGroups[i],
                amountPerAddress
            );

            if (result.success) {
                Logger.success(`钱包 ${Logger.address(result.from)} 重试成功`);
            } else {
                Logger.error(`钱包 ${Logger.address(result.from)} 重试失败: ${result.error}`);
            }

            // 添加随机延迟
            if (i < failedKeys.length - 1) {
                const delay = Math.floor(Math.random() * 30000) + 1000;
                Logger.processing(`等待 ${Math.floor(delay/1000)} 秒后继续...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // 清理已处理的失败记录
        fs.unlinkSync(failedKeysPath);
        fs.unlinkSync(failedAddressesPath);
    } catch (error) {
        Logger.error(`重试任务失败: ${error.message}`);
    }
}

async function deployAndDistribute(privateKey, recipients, amountPerAddress) {
    let wallet;
    try {
        // 读取合约数据
        const contractData = JSON.parse(fs.readFileSync(path.join(paths.contracts, 'contract.json'), 'utf8'));
        const abi = contractData.abi;
        const bytecode = contractData.bytecode;

        // 连接到Sepolia网络
        const provider = new ethers.JsonRpcProvider(networks.sepolia.rpc);
        wallet = new ethers.Wallet(privateKey, provider);
        
        // 获取钱包余额
        const balance = await provider.getBalance(wallet.address);
        
        Logger.info(`开始处理钱包: ${Logger.address(wallet.address)}，余额: ${Logger.amount(ethers.formatEther(balance))} ETH`);
        Logger.info(`接收地址: ${recipients.join(', ')}`);

        // 为每个接收地址准备相同金额
        const amount = ethers.parseEther(amountPerAddress.toString());
        const amounts = recipients.map(() => amount);
        
        // 计算总金额
        const totalAmount = amount * BigInt(recipients.length);
        
        Logger.info(`每个地址金额: ${Logger.amount(amountPerAddress)} ETH`);
        Logger.info(`总金额: ${Logger.amount(ethers.formatEther(totalAmount))} ETH`);

        // 检查余额是否足够
        if (balance < totalAmount) {
            Logger.error('余额不足');
            Logger.error(`需要: ${Logger.amount(ethers.formatEther(totalAmount))} ETH`);
            Logger.error(`实际: ${Logger.amount(ethers.formatEther(balance))} ETH`);
            saveFailedDistribution(privateKey, recipients, '余额不足');
            return {
                success: false,
                error: '余额不足',
                from: wallet.address,
                recipientCount: recipients.length
            };
        }

        // 部署合约
        Logger.info('正在部署合约...');
        const factory = new ethers.ContractFactory(abi, bytecode, wallet);
        const contract = await factory.deploy();
        await contract.waitForDeployment();
        const contractAddress = await contract.getAddress();
        Logger.info(`合约已部署成功，合约地址: ${Logger.address(contractAddress)}`);

        // 发送分发交易
        Logger.info('准备发送分发交易...');
        const tx = await contract.distributeEth(recipients, amounts, {
            value: totalAmount,
            gasLimit: transaction.gasLimit
        });   
        // 等待交易确认
        const receipt = await tx.wait();
        Logger.info(`分发交易已确认，交易哈希: ${Logger.hash(tx.hash)}`);
        
        return {
            success: true,
            hash: tx.hash,
            contractAddress,
            from: wallet.address,
            recipientCount: recipients.length
        };
        
    } catch (error) {
        Logger.error('操作失败:', error);
        saveFailedDistribution(privateKey, recipients, error.message);
        return {
            success: false,
            error: error.message,
            from: wallet?.address,
            recipientCount: recipients.length
        };
    }
}

// 编译并部署合约
async function prepareContract() {
    return new Promise((resolve, reject) => {
        // 1. 编译合约
        Logger.info('\n开始编译合约...');
        const compileProcess = exec('node src/scripts/compile.js');
        
        compileProcess.stdout.on('data', (data) => {
            process.stdout.write(data);
        });

        compileProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        compileProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error('合约编译失败'));
                return;
            }
            resolve();
        });
    });
}

async function processAllWallets(amountPerAddress) {
    try {
        // 首先编译合约
        await prepareContract();

        const privateKeys = getPrivateKeys();
        const addressGroups = getAddressGroups();

        Logger.info(`\n准备处理 ${addressGroups.length} 组地址`);
        
        if (privateKeys.length < addressGroups.length) {
            throw new Error(`私钥数量(${privateKeys.length})小于地址组数量(${addressGroups.length})！`);
        }

        for (let i = 0; i < addressGroups.length; i++) {
            const result = await deployAndDistribute(
                privateKeys[i],
                addressGroups[i],
                amountPerAddress
            );

            if (result.success) {
                Logger.success(`钱包 ${result.from} 分发成功`);
            } else {
                Logger.error(`钱包 ${result.from} 操作失败: ${result.error}`);
            }

            // 添加随机延迟
            if (i < addressGroups.length - 1) {
                const delay = Math.floor(Math.random() * 30000) + 1000;
                Logger.info(`等待 ${Math.floor(delay/1000)} 秒后处理下一组...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    } catch (error) {
        Logger.error('程序执行错误:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    Logger.info(`\n开始执行分发任务，每个地址将收到 ${amountPerAddress} ETH`);

    if (process.argv.includes('retry')) {
        retryFailedDistributions(amountPerAddress)
            .then(() => Logger.success('重试任务完成'))
            .catch(error => Logger.error('��序执行出错:', error));
    } else {
        processAllWallets(amountPerAddress)
            .then(() => Logger.success('所有分发任务完成'))
            .catch(error => Logger.error('程序执行出错:', error));
    }
}

module.exports = {
    processAllWallets,
    deployAndDistribute,
    retryFailedDistributions
};