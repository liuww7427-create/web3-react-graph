# Web3 Log → The Graph → React

将链上日志数据写入合约并通过 The Graph 读取，前端用 web3-react 展示交易哈希和合约地址。

## 目录结构
- `contracts/` Hardhat 项目，包含 `LogStorage` 合约与部署脚本。
- `subgraph/` Subgraph 定义与映射，监听合约事件 `DataLogged`。
- `app/` Vite + React + web3-react 前端，写入数据并查询 The Graph。

## 准备
- Node 18+，npm
- MetaMask（连接到测试网，默认使用 Sepolia / 链 ID 11155111）
- RPC 服务（Infura/Alchemy 等）
- Graph Studio 账户（用于部署 subgraph）

## 步骤 1：部署合约到测试网
```bash
cd contracts
npm install
cp .env.example .env
# 填写 SEPOLIA_RPC_URL、PRIVATE_KEY
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```
记下输出的 `LogStorage` 合约地址。

## 步骤 2：配置并部署 Subgraph
```bash
cd subgraph
npm install
# 将 subgraph.yaml 中的 address 替换为部署的合约地址，并可设置 startBlock
npm run codegen
npm run build
```
在 Graph Studio 创建子图后：
```bash
npx graph deploy \
  --node https://api.studio.thegraph.com/deploy/ \
  --deploy-key <DEPLOY_KEY> \
  <subgraph-name> \
  subgraph.yaml
```
部署成功后会得到查询 URL，将其用于前端的 `VITE_SUBGRAPH_URL`。

## 步骤 3：前端运行
```bash
cd app
npm install
cp .env.example .env
# 设置 VITE_CONTRACT_ADDRESS、VITE_SUBGRAPH_URL（Graph 查询端点）、VITE_CHAIN_ID=11155111
npm run dev
```
打开本地地址，连接 MetaMask，输入文本发送交易。前端会展示最近交易哈希，并从 The Graph 读取最新日志（包含 id、Tx Hash、合约地址、链 ID、时间）。

## 两种上链方式
- 方式一：通过合约方法 `transferWithLog` 转账，事件 `TransferLogged` 会被 Subgraph 记录，可查询转账信息。
- 方式二：调用合约 `logData` 写入字符串，触发事件供 Subgraph 读取。

> 合约有更新，重新部署后记得更新前端 `.env` 的 `VITE_CONTRACT_ADDRESS`，并在 `subgraph/subgraph.yaml` 中替换为新地址后执行 `npm run codegen && npm run build` 再部署子图。

## Subgraph 查询示例
```graphql
query Latest {
  logEntries(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    txHash
    sender
    data
    timestamp
    contractAddress
    chainId
  }
}
```

## 关键文件
- 合约：`contracts/contracts/LogStorage.sol`
- 部署脚本：`contracts/scripts/deploy.js`
- Subgraph 映射：`subgraph/src/mapping.ts`
- 前端入口：`app/src/App.jsx`
