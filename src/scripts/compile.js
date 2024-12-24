const fs = require('fs');
const solc = require('solc');
const path = require('path');
const { paths } = require('../utils/config');
const Logger = require('../utils/logger');

Logger.title('Solidity 合约编译');

// 读取 Solidity 文件内容
const contractPath = path.join(paths.contracts, 'Distributor.sol');

// 确保contracts目录存在
if (!fs.existsSync(paths.contracts)) {
    fs.mkdirSync(paths.contracts, { recursive: true });
}

const source = fs.readFileSync(contractPath, 'utf8');
Logger.divider();

Logger.processing('正在编译合约...');

// 准备编译配置
const input = {
    language: 'Solidity',
    sources: {
        'Distributor.sol': {
            content: source
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['*']
            }
        }
    }
};

try {
    // 编译合约
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    // 检查编译错误
    if (output.errors) {
        let hasError = false;
        output.errors.forEach(error => {
            if (error.severity === 'error') {
                Logger.error('编译错误');
                Logger.error(`位置: ${error.sourceLocation?.file || '未知'}`);
                Logger.error(`信息: ${error.message}`);
                hasError = true;
            } else {
                Logger.warning('编译警告');
                Logger.warning(`位置: ${error.sourceLocation?.file || '未知'}`);
                Logger.warning(`信息: ${error.message}`);
            }
        });
        
        if (hasError) {
            Logger.error('编译失败，存在错误');
            process.exit(1);
        }
    }
    
    const contract = output.contracts['Distributor.sol']['Distributor'];
    
    // 保存编译结果
    const outputPath = path.join(paths.contracts, 'contract.json');
    fs.writeFileSync(
        outputPath,
        JSON.stringify({
            abi: contract.abi,
            bytecode: contract.evm.bytecode.object
        }, null, 2)
    );
    
    // 同时保存ABI到单独的文件
    const abiPath = path.join(paths.contracts, 'abi.json');
    fs.writeFileSync(abiPath, JSON.stringify(contract.abi, null, 2));
    
    Logger.success('合约编译成功');
} catch (error) {
    Logger.error('编译失败');
    Logger.error(`错误信息: ${error.message}`);
    process.exit(1);
} 