const path = require('path');
const fs = require('fs');

// 确保目录存在
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// 项目根目录
const rootDir = path.join(__dirname, '../..');

// 定义路径配置
const pathConfig = {
    contracts: path.join(rootDir, 'src/contracts'),
    data: path.join(rootDir, 'data'),
    logs: path.join(rootDir, 'logs')
};

// 初始化目录
Object.values(pathConfig).forEach(ensureDirectoryExists);

module.exports = {
    // 网络配置
    networks: {
        sepolia: {
            rpc: 'https://sepolia.infura.io/v3/f4b6a411058a463082a46bbb9a5f3d9a',
            chainId: 11155111
        },
        arbitrum: {
            rpc: 'https://arbitrum-mainnet.infura.io/v3/f4b6a411058a463082a46bbb9a5f3d9a',
            chainId: 42161
        }
    },

    // 文件路径配置
    paths: pathConfig,

    // 交易配置
    transaction: {
        gasLimit: 5000000n,
        confirmations: 1
    },

    // 分发配置
    distribution: {
        defaultAmount: 0.2,
        defaultGroupSize: 4
    },

    // 跨链配置
    bridge: {
        amount: 0.00005,
        layerZeroFee: '0.000008879862610065'
    }
}; 