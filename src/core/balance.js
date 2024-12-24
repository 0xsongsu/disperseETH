const { ethers } = require('ethers');
const { readFileLines } = require('../utils/helpers');
const { networks, paths } = require('../utils/config');
const Logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

async function checkBalance(address, provider) {
    try {
        const balance = await provider.getBalance(address);
        return {
            address,
            balance: ethers.formatEther(balance),
            raw: balance
        };
    } catch (error) {
        Logger.error(`查询失败: ${error.message}`);
        Logger.error(`地址: ${Logger.address(address)}`);
        return {
            address,
            balance: '查询失败',
            error: error.message
        };
    }
}

function saveZeroBalanceAddresses(addresses) {
    try {
        const filePath = path.join(paths.data, 'zero_balance_addresses.txt');
        fs.writeFileSync(filePath, addresses.join('\n') + '\n');
        Logger.success(`已将余额为0的地址保存到: zero_balance_addresses.txt`);
        Logger.info(`文件路径: ${filePath}`);
    } catch (error) {
        Logger.error('保存余额为0的地址失败');
        Logger.error(`错误信息: ${error.message}`);
    }
}

async function checkAllBalances() {
    try {
        // 连接到网络
        const provider = new ethers.JsonRpcProvider(networks.sepolia.rpc);

        // 读取私钥文件中的地址
        const privateKeys = readFileLines(path.join(paths.data, 'pk.txt'));
        const pkAddresses = privateKeys.map(pk => {
            const wallet = new ethers.Wallet(pk);
            return wallet.address;
        });

        // 读取地址文件中的地址
        const addresses = readFileLines(path.join(paths.data, 'address.txt'));

        // 合并所有地址并去重
        const allAddresses = [...new Set([...pkAddresses, ...addresses])];

        Logger.title('开始查询钱包余额');
        Logger.info(`总共 ${allAddresses.length} 个地址`);
        Logger.divider();

        // 查询所有地址余额
        Logger.processing('正在查询余额...');
        const results = await Promise.all(allAddresses.map(addr => checkBalance(addr, provider)));
        
        // 计算总余额
        let totalBalance = 0n;
        let validResults = results.filter(r => !r.error);
        validResults.forEach(r => totalBalance += ethers.parseEther(r.balance));

        // 找出余额为0的地址
        const zeroBalanceAddresses = validResults
            .filter(r => r.balance === '0.0')
            .map(r => r.address);

        // 输出结果
        Logger.title('余额查询结果');
        results.forEach(({ address, balance, error }) => {
            if (error) {
                Logger.error(`查询失败: ${error}`);
                Logger.error(`地址: ${Logger.address(address)}`);
            } else {
                Logger.info(`${Logger.address(address)}: ${Logger.amount(balance)}`);
            }
        });

        Logger.title('汇总信息');
        Logger.divider();
        Logger.info(`总钱包数量: ${allAddresses.length}`);
        Logger.info(`成功查询数量: ${validResults.length}`);
        Logger.info(`余额为0的地址数量: ${zeroBalanceAddresses.length}`);

        // 如果有余额为0的地址，保存到文件
        if (zeroBalanceAddresses.length > 0) {
            Logger.divider();
            Logger.processing('正在保存余额为0的地址...');
            saveZeroBalanceAddresses(zeroBalanceAddresses);
        }
        
        return results;
    } catch (error) {
        Logger.error('查询失败');
        Logger.error(`错误信息: ${error.message}`);
        throw error;
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    checkAllBalances()
        .then(() => process.exit(0))
        .catch(error => {
            Logger.error(`程序执行出错: ${error.message}`);
            process.exit(1);
        });
}

module.exports = { checkAllBalances }; 