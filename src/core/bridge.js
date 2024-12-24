const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { networks, paths, bridge } = require('../utils/config');
const { readFileLines } = require('../utils/helpers');
const Logger = require('../utils/logger');

function saveFailedBridge(privateKey, error) {
    try {
        // 确保logs目录存在
        if (!fs.existsSync(paths.logs)) {
            fs.mkdirSync(paths.logs, { recursive: true });
        }

        const failedKeysPath = path.join(paths.logs, 'failed_bridge_keys.txt');
        const failedLogsPath = path.join(paths.logs, 'failed_bridge_logs.txt');

        // 保存失败的私钥
        fs.appendFileSync(failedKeysPath, privateKey + '\n');

        // 保存失败日志
        const logEntry = `时间: ${new Date().toISOString()}\n` +
            `钱包: ${new ethers.Wallet(privateKey).address}\n` +
            `错误: ${error}\n` +
            '----------------------------------------\n';
        fs.appendFileSync(failedLogsPath, logEntry);

        Logger.info('失败记录已保存');
    } catch (error) {
        Logger.error(`保存失败记录时出错: ${error.message}`);
    }
}

async function swapAndBridge(privateKey, ethAmount) {
    let wallet;
    try {
        // 读取完整的 ABI
        const abi = JSON.parse(fs.readFileSync(path.join(__dirname, 'abi/abi.json'), 'utf8'));

        // 设置provider和wallet
        const provider = new ethers.JsonRpcProvider(networks.arbitrum.rpc);
        wallet = new ethers.Wallet(privateKey.trim(), provider);

        const contractAddress = '0xfca99f4b5186d4bfbdbd2c542dca2eca4906ba45';
        
        // 创建合约实例
        const contract = new ethers.Contract(
            contractAddress,
            abi,
            wallet
        );

        const address = wallet.address;
        Logger.title('处理钱包');
        Logger.info(`地址: ${Logger.address(address)}`);

        // 将ETH金额转换为Wei
        const amountInWei = ethers.parseEther(ethAmount.toString());
        const layerZeroFeeWei = ethers.parseEther(bridge.layerZeroFee);
        
        // 使用BigInt进行计算
        const totalAmount = amountInWei + layerZeroFeeWei;

        // 获取当前 gas 价格
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice * 2n;
        const gasLimit = 5000000n;
        Logger.processing('发送交易...');

        // 发送交易
        const tx = await contract.swapAndBridge(
            amountInWei,
            '0x0',
            161n,
            wallet.address,
            wallet.address,
            '0x0000000000000000000000000000000000000000',
            '0x',
            {
                gasPrice: gasPrice,
                gasLimit: gasLimit,
                value: totalAmount
            }
        );
        
        // 等待交易确认
        const receipt = await tx.wait();
        Logger.success(`交易已确认，区块号: ${receipt.blockNumber}，哈希: ${Logger.hash(tx.hash)}`);
        
        return {
            success: true,
            hash: tx.hash,
            blockNumber: receipt.blockNumber,
            address: address
        };
    } catch (error) {
        Logger.error(`交易失败: ${error.message}`);
        Logger.error(`钱包地址: ${Logger.address(wallet?.address)}`);
        saveFailedBridge(privateKey, error.message);
        return {
            success: false,
            error: error.message,
            details: error,
            address: wallet?.address
        };
    }
}

async function retryFailedBridge(ethAmount) {
    try {
        const failedKeysPath = path.join(paths.logs, 'failed_bridge_keys.txt');

        // 检查是否存在失败记录
        if (!fs.existsSync(failedKeysPath)) {
            Logger.warning('没有找到失败记录');
            return;
        }

        // 读取失败的私钥
        const failedKeys = readFileLines(failedKeysPath);
        if (failedKeys.length === 0) {
            Logger.info('没有需要重试的交易');
            return;
        }

        Logger.title('开始重试失败的购买任务');
        Logger.info(`找到 ${failedKeys.length} 个失败记录`);
        Logger.info(`每个钱包将购买 ${Logger.amount(ethAmount)} ETH`);
        Logger.divider();

        for (const privateKey of failedKeys) {
            const result = await swapAndBridge(privateKey, ethAmount);
            if (result.success) {
                Logger.success(`钱包 ${Logger.address(result.address)} 重试成功`);
            } else {
                Logger.error(`钱包 ${Logger.address(result.address)} 重试失败: ${result.error}`);
            }

            // 添加随机延迟
            if (privateKey !== failedKeys[failedKeys.length - 1]) {
                const delay = Math.floor(Math.random() * 30000) + 1000;
                Logger.processing(`等待 ${Math.floor(delay/1000)} 秒后继续...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // 清理已处理的失败记录
        fs.unlinkSync(failedKeysPath);
        Logger.success('重试任务完成');
    } catch (error) {
        Logger.error(`重试任务失败: ${error.message}`);
    }
}

async function processAllWallets(ethAmount) {
    try {
        // 读取所有私钥
        const privateKeys = readFileLines(path.join(paths.data, 'pk.txt'));

        Logger.title('开始处理跨链任务');
        Logger.info(`找到 ${privateKeys.length} 个钱包`);
        Logger.info(`每个钱包将跨链 ${Logger.amount(ethAmount)}`);
        Logger.divider();

        // 依次处理每个钱包
        for (const privateKey of privateKeys) {
            try {
                const result = await swapAndBridge(privateKey, ethAmount);
                if (result.success) {
                } else {
                    Logger.error(`钱包 ${Logger.address(result.address)} 交易失败: ${result.error}`);
                }

                // 添加随机延迟
                const delay = Math.floor(Math.random() * 30000) + 1000;
                Logger.processing(`等待 ${Math.floor(delay/1000)} 秒后继续...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } catch (error) {
                Logger.error(`处理钱包时发生错误: ${error.message}`);
            }
        }
    } catch (error) {
        Logger.error(`读取私钥文件失败: ${error.message}`);
    }
}

async function main() {
    try {        
        Logger.title('ETH 跨链任务');
        // 使用环境变量中的金额，如果没有则使用置文件中的默认值
        const amount = Number(process.env.BRIDGE_AMOUNT) || bridge.amount;
        
        if (process.argv.includes('retry')) {
            await retryFailedBridge(amount);
        } else {
            Logger.info(`每个钱包将跨链 ${Logger.amount(amount)}`);
            Logger.divider();
            await processAllWallets(amount);
            Logger.success('所有钱包处理完成');
        }
    } catch (error) {
        Logger.error(`程序运行出错: ${error.message}`);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => Logger.error(`程序执行出错: ${error.message}`));
}

module.exports = {
    swapAndBridge,
    processAllWallets,
    retryFailedBridge
};
