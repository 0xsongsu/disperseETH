const fs = require('fs');
const path = require('path');
const config = require('./config');

// 文件读取辅助函数
function readFileLines(filePath) {
    return fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

// 分组辅助函数
function groupAddresses(addresses, groupSize) {
    const groups = [];
    for (let i = 0; i < addresses.length; i += groupSize) {
        const group = addresses.slice(i, Math.min(i + groupSize, addresses.length));
        if (group.length > 0) {
            groups.push(group);
        }
    }
    return groups;
}

// 失败记录处理
function saveFailedTransaction(privateKey, addresses, error) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = config.paths.logs;

    fs.appendFileSync(path.join(logPath, 'failed_keys.txt'), `${privateKey}\n`);
    fs.appendFileSync(path.join(logPath, 'failed_addresses.txt'), addresses.join('\n') + '\n');
    fs.appendFileSync(
        path.join(logPath, 'failed_logs.txt'),
        `\n[${timestamp}]\nPrivate Key: ${privateKey}\nAddresses: ${addresses.join(', ')}\nError: ${error}\n`
    );
}

module.exports = {
    readFileLines,
    groupAddresses,
    saveFailedTransaction
}; 