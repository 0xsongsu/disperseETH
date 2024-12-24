# ETH 工具

一个用于测试网ETH 跨链和批量分发的工具。

## 功能

- 购买测试币：从 Arbitrum 跨链到 Sepolia
- 重试购买：重试失败的测试币购买记录
- 批量分发：将 ETH 批量分发给多个地址
- 重试分发：重试失败的分发记录
- 查询余额：查询所有钱包的余额
- 数据清理：清理所有数据文件

## 使用说明

### 1. 安装依赖

```bash
npm install
```

### 2. 配置文件

在 `data` 目录下：
- `pk.txt`: 存放用于发送的钱包私钥，每行一个
- `address.txt`: 存放接收资金的钱包地址，每行一个

### 3. 运行程序

```bash
node start.js
```

## 注意事项

1. 如果跨链失败，请查看该地址跨链交易是否在Arb区块浏览器中存在并失败，如果出现这种问题，说明预留的layerZeroFee不足，需要检查最新的layerZeroFee，直接点击 https://arbiscan.io/address/0xfca99f4b5186d4bfbdbd2c542dca2eca4906ba45 查看最新成功的跨链交易中的layerZeroFee，然后修改 `src/utils/config.js` 中的 `layerZeroFee` 为最新值。

## 错误处理

- 交易失败会自动保存到对应的失败记录文件，包括私钥和地址
- 可以使用重试功能处理失败的记录，重试成功后会自动删除失败记录文件，包括私钥和地址
- 查看 logs 目录下的日志文件获取详细错误信息

## 配置说明

在 `src/utils/config.js` 中可以配置：

- RPC 节点地址
- Gas 限制
- 默认金额
- 文件路径
- 跨链参数