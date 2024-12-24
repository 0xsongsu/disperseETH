const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function promptUser() {
    console.log('\n=== ETH 工具选择 ===');
    console.log('1. 购买测试币');
    console.log('2. 重试购买测试币');
    console.log('3. 批量分发');
    console.log('4. 重试失败转账');
    console.log('5. 查询钱包余额');
    console.log('6. 清理所有数据');
    console.log('0. 退出程序');
    console.log('──────────────────────────────────────────────────');

    rl.question('请选择功能 (0-6): ', async (choice) => {
        switch (choice) {
            case '0':
                console.log('程序已退出');
                process.exit(0);
                break;
            case '1':
                await handleBridge();
                break;
            case '2':
                await handleRetryBridge();
                break;
            case '3':
                await handleDistribution();
                break;
            case '4':
                await handleRetry();
                break;
            case '5':
                await handleCheckBalance();
                break;
            case '6':
                await handleClean();
                break;
            default:
                console.log('无效的选择，请重试');
                promptUser();
                break;
        }
    });
}

async function handleBridge() {
    rl.question('请输入购买测试币的ETH数量: ', (amount) => {
        if (isNaN(amount) || amount <= 0) {
            console.log('请输入有效的数字！');
            handleBridge();
            return;
        }

        console.log(`\n开始购买 ${amount} ETH的测试币...`);
        
        const bridgeProcess = exec('node src/core/bridge.js', {
            env: {
                ...process.env,
                BRIDGE_AMOUNT: amount
            }
        });
        
        bridgeProcess.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        bridgeProcess.stderr.on('data', (data) => {
            console.error(data.toString());
        });

        bridgeProcess.on('close', (code) => {
            console.log('\n执行完成，按回车键继续...');
            rl.question('', () => {
                promptUser();
            });
        });
    });
}

async function handleRetryBridge() {
    rl.question('请输入重试购买的ETH数量: ', (amount) => {
        if (isNaN(amount) || amount <= 0) {
            console.log('请输入有效的数字！');
            handleRetryBridge();
            return;
        }

        console.log(`\n开始重试购买 ${amount} ETH的测试币...`);
        
        const bridgeProcess = exec('node src/core/bridge.js retry', {
            env: {
                ...process.env,
                BRIDGE_AMOUNT: amount
            }
        });
        
        bridgeProcess.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        bridgeProcess.stderr.on('data', (data) => {
            console.error(data.toString());
        });

        bridgeProcess.on('close', (code) => {
            console.log('\n执行完成，按回车键继续...');
            rl.question('', () => {
                promptUser();
            });
        });
    });
}

async function handleDistribution() {
    rl.question('请输入每个地址分发的ETH数量: ', (amount) => {
        if (isNaN(amount) || amount <= 0) {
            console.log('请输入有效的数字！');
            handleDistribution();
            return;
        }

        rl.question('请输入每组地址的数量 (默认为4): ', (groupSize) => {
            groupSize = parseInt(groupSize) || 4;
            
            if (isNaN(groupSize) || groupSize <= 0) {
                console.log('使用默认组大小: 4');
                groupSize = 4;
            }

            process.env.DISTRIBUTION_AMOUNT = amount;
            process.env.GROUP_SIZE = groupSize;

            console.log(`\n开始分发，每个地址 ${amount} ETH，每组 ${groupSize} 个地址...`);
            
            const distributeProcess = exec('node src/core/distribute.js', {
                env: { ...process.env }
            });

            distributeProcess.stdout.on('data', (data) => {
                process.stdout.write(data);
            });

            distributeProcess.stderr.on('data', (data) => {
                process.stderr.write(data);
            });

            distributeProcess.on('close', (code) => {
                console.log('\n执行完成，按回车键继续...');
                rl.question('', () => {
                    promptUser();
                });
            });
        });
    });
}

async function handleRetry() {
    rl.question('请输入重试分发的ETH数量: ', (amount) => {
        if (isNaN(amount) || amount <= 0) {
            console.log('请输入有效的数字！');
            handleRetry();
            return;
        }

        console.log(`开始重��失败的分发任务，每个地址 ${amount} ETH...`);
        
        const retryProcess = exec('node src/core/distribute.js retry', {
            env: {
                ...process.env,
                DISTRIBUTION_AMOUNT: amount
            }
        });
        
        retryProcess.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        retryProcess.stderr.on('data', (data) => {
            console.error(data.toString());
        });

        retryProcess.on('close', (code) => {
            console.log('\n执行完成，按回车键继续...');
            rl.question('', () => {
                promptUser();
            });
        });
    });
}

async function handleCheckBalance() {
    console.log('开始查询钱包余额...');
    const checkProcess = exec('node src/core/balance.js', {
        env: { ...process.env }
    });
    
    checkProcess.stdout.on('data', (data) => {
        console.log(data.toString());
    });

    checkProcess.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    checkProcess.on('close', (code) => {
        console.log('\n执行完成，按回车键继续...');
        rl.question('', () => {
            promptUser();
        });
    });
}

async function handleClean() {
    rl.question('确定要清理所有数据吗？这将清空所有私钥和地址记录。(y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
            console.log('开始清理数据...');
            
            const cleanProcess = exec('node src/scripts/clean.js', {
                env: { ...process.env }
            });

            cleanProcess.stdout.on('data', (data) => {
                console.log(data.toString());
            });

            cleanProcess.stderr.on('data', (data) => {
                console.error(data.toString());
            });

            cleanProcess.on('close', (code) => {
                console.log('\n执行完成，按回车键继续...');
                rl.question('', () => {
                    promptUser();
                });
            });
        } else {
            console.log('已取消清理操作');
            promptUser();
        }
    });
}

console.log('欢迎使用 ETH 工具！');
promptUser();

// 处理程序退出
process.on('SIGINT', () => {
    console.log('\n程序已终止');
    process.exit(0);
}); 