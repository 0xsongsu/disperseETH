const chalk = require('chalk');

class Logger {
    static success(message) {
        console.log(chalk.green('✓ ') + message);
    }

    static error(message) {
        console.log(chalk.red('✗ ') + message);
    }

    static info(message) {
        console.log(chalk.blue('ℹ ') + message);
    }

    static warning(message) {
        console.log(chalk.yellow('⚠ ') + message);
    }

    static processing(message) {
        console.log(chalk.cyan('⋯ ') + message);
    }

    static title(message) {
        console.log('\n' + chalk.bold.blue('=== ' + message + ' ==='));
    }

    static divider() {
        console.log(chalk.gray('─'.repeat(50)));
    }

    static amount(eth, label = 'ETH') {
        return chalk.yellow(eth) + ' ' + chalk.gray(label);
    }

    static address(addr) {
        return chalk.cyan(addr);
    }

    static hash(hash) {
        return chalk.magenta(hash);
    }
}

module.exports = Logger; 