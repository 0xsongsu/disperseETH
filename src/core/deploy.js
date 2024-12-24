const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { networks, paths } = require('../utils/config');
const Logger = require('../utils/logger');

async function deployContract() {
    try {
        Logger.title('开始部署合约');
        // 读取编译后的合约数据
        const contractPath = path.join(paths.contracts, 'contract.json');
        const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        
        // 从文件读取部署用的私钥
        const deployerPrivateKey = fs.readFileSync(path.join(paths.data, 'deployer-pk.txt'), 'utf8').trim();
        
        // 连接到Sepolia网络
        const provider = new ethers.JsonRpcProvider(networks.sepolia.rpc);
        const wallet = new ethers.Wallet(deployerPrivateKey, provider);
        
        Logger.info(`部署钱包: ${Logger.address(wallet.address)}`);
        
        // 获取钱包余额
        const balance = await provider.getBalance(wallet.address);
        Logger.info(`钱包余额: ${Logger.amount(ethers.formatEther(balance))}`);
        Logger.divider();
        
        // 创建合约工厂
        const factory = new ethers.ContractFactory(
            contractData.abi,
            contractData.bytecode,
            wallet
        );
        
        // 部署合约
        Logger.processing('正在部署合约...');
        const contract = await factory.deploy();
        Logger.processing(`合约创建交易已发送，Hash: ${Logger.hash(contract.deploymentTransaction().hash)}`);
        await contract.waitForDeployment();
        
        const contractAddress = await contract.getAddress();
        Logger.success(`合约已部署成功`);
        Logger.info(`合约地址: ${Logger.address(contractAddress)}`);
        Logger.info(`区块号: ${contract.deploymentTransaction().blockNumber}`);
        
        // 保存合约地址到文件
        fs.writeFileSync(path.join(paths.contracts, 'contract-address.txt'), contractAddress);
        Logger.success('合约地址已保存到 contract-address.txt');
        
    } catch (error) {
        Logger.error('部署失败');
        Logger.error(`错误信息: ${error.message}`);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    deployContract()
        .then(() => {
            Logger.divider();
            Logger.success('部署任务完成');
        })
        .catch(error => Logger.error(error.message));
}

module.exports = { deployContract }; 