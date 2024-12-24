const fs = require('fs');
const path = require('path');
const { paths } = require('../utils/config');
const Logger = require('../utils/logger');

Logger.title('清理数据');

try {
    // 要清理的文件列表
    const files = [
        path.join(paths.data, 'pk.txt'),
        path.join(paths.data, 'address.txt'),
        path.join(paths.logs, 'failed_bridge_keys.txt'),
        path.join(paths.logs, 'failed_bridge_logs.txt'),
        path.join(paths.logs, 'failed_distribute_keys.txt'),
        path.join(paths.logs, 'failed_distribute_logs.txt'),
        path.join(paths.logs, 'failed_distribute_addresses.txt')
    ];

    // 清理每个文件
    files.forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            Logger.success(`已删除: ${path.basename(file)}`);
        }
    });

    // 确保 data 目录存在
    if (!fs.existsSync(paths.data)) {
        fs.mkdirSync(paths.data, { recursive: true });
    }

    // 创建必要的文件
    fs.writeFileSync(
        path.join(paths.data, 'pk.txt'),
        '// 私钥，多个私钥用换行符分隔\n'
    );
    Logger.info('已创建: pk.txt');

    fs.writeFileSync(
        path.join(paths.data, 'address.txt'),
        '// 接收资金的钱包地址，多个钱包地址用换行符分隔\n'
    );
    Logger.info('已创建: address.txt');

    Logger.success('清理完成');
} catch (error) {
    Logger.error('清理失败');
    Logger.error(`错误信息: ${error.message}`);
    process.exit(1);
} 