import { useEffect, useMemo, useState } from "react"; // React hooks
import { gql, request } from "graphql-request"; // GraphQL 请求工具
import { ethers } from "ethers"; // 以太坊交互库
import { metaMask, metaMaskHooks } from "./connectors"; // MetaMask 连接器
import TransferForm from "./components/TransferForm";
import LogForm from "./components/LogForm";

const { useAccount, useChainId, useIsActive, useIsActivating, useProvider } = metaMaskHooks; // web3-react hooks

// GraphQL 查询：同时读取日志和转账记录
const LOG_QUERY = gql`
  query LatestLogs($first: Int!) {
    logEntries(first: $first, orderBy: timestamp, orderDirection: desc) {
      id
      txHash
      sender
      data
      timestamp
      contractAddress
      chainId
    }
    transferEntries(first: $first, orderBy: timestamp, orderDirection: desc) {
      id
      txHash
      from
      to
      amount
      timestamp
      contractAddress
      chainId
    }
  }
`;

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || ""; // 合约地址
const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL || ""; // 子图查询端点
const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111); // 目标链 ID，默认 Sepolia

const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "string", name: "data", type: "string" }],
    name: "logData",
    outputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address payable", name: "to", type: "address" }],
    name: "transferWithLog",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      { indexed: false, internalType: "string", name: "data", type: "string" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" }
    ],
    name: "DataLogged",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" }
    ],
    name: "TransferLogged",
    type: "event"
  }
];

const formatHex = (value) => {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

function App() {
  const account = useAccount(); // 当前账户
  const chainId = useChainId(); // 当前链 ID
  const isActive = useIsActive(); // 是否已连接
  const isActivating = useIsActivating(); // 是否正在连接
  const provider = useProvider(); // 当前 provider

  const [input, setInput] = useState(""); // 日志输入
  const [logStatus, setLogStatus] = useState(""); // 日志发送状态
  const [transferStatus, setTransferStatus] = useState(""); // 转账状态
  const [logs, setLogs] = useState([]); // 日志列表
  const [transfers, setTransfers] = useState([]); // 转账记录列表
  const [loadingLogs, setLoadingLogs] = useState(false); // 是否正在拉取
  const [txHash, setTxHash] = useState(""); // 最近日志交易哈希
  const [transferHash, setTransferHash] = useState(""); // 最近转账交易哈希
  const [balance, setBalance] = useState(""); // 余额
  const [transferTo, setTransferTo] = useState(""); // 转账接收地址
  const [transferAmount, setTransferAmount] = useState(""); // 转账金额

  const networkOk = useMemo(() => !isActive || chainId === TARGET_CHAIN_ID, [isActive, chainId]); // 链匹配校验

  const connectWallet = async () => {
    try {
      setLogStatus("连接钱包中...");
      console.info("[wallet] activating MetaMask to chain", TARGET_CHAIN_ID);
      await metaMask.activate(TARGET_CHAIN_ID);
      console.info("[wallet] activated");
      setLogStatus("已连接");
    } catch (error) {
      console.error(error);
      setLogStatus(error.message || "连接失败");
    }
  };

  const disconnectWallet = async () => {
    // Some wallet connectors may not implement deactivate; fall back to resetState.
    if (typeof metaMask.deactivate === "function") {
      await metaMask.deactivate();
    }
    if (typeof metaMask.resetState === "function") {
      metaMask.resetState();
    }
    setLogStatus("");
  };

  const sendLog = async () => {
    if (!CONTRACT_ADDRESS) {
      setLogStatus("请先在 .env 设置 VITE_CONTRACT_ADDRESS");
      return;
    }
    if (!input.trim()) {
      setLogStatus("请输入要上链的内容");
      return;
    }
    try {
      setLogStatus("发送交易中...");
      const externalProvider = metaMask.provider || provider || window.ethereum;
      if (!externalProvider || typeof externalProvider.request !== "function") {
        setLogStatus("未获取到有效的钱包 provider，请先连接钱包");
        return;
      }
      console.info("[tx] logData with input", input.trim());
      const browserProvider = new ethers.BrowserProvider(externalProvider);
      const signer = await browserProvider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.logData(input.trim());
      setTxHash(tx.hash);
      setLogStatus(`交易已发送：${tx.hash}`);
      const receipt = await tx.wait();
      setLogStatus(`已上链：${receipt.hash}`);
      setInput("");
      await fetchLogs();
    } catch (error) {
      console.error(error);
      setLogStatus(error.shortMessage || error.message || "交易失败");
    }
  };

  const sendTransfer = async () => {
    if (!CONTRACT_ADDRESS) {
      setTransferStatus("请先在 .env 设置 VITE_CONTRACT_ADDRESS");
      return;
    }
    if (!transferTo.trim()) {
      setTransferStatus("请输入接收地址");
      return;
    }
    if (!ethers.isAddress(transferTo.trim())) {
      setTransferStatus("接收地址格式不正确");
      return;
    }
    if (!transferAmount || Number(transferAmount) <= 0) {
      setTransferStatus("请输入大于 0 的转账金额（ETH）");
      return;
    }
    try {
      const value = ethers.parseEther(transferAmount.trim());
      setTransferStatus("发送转账交易中...");
      const externalProvider = metaMask.provider || provider || window.ethereum;
      if (!externalProvider || typeof externalProvider.request !== "function") {
        setTransferStatus("未获取到有效的钱包 provider，请先连接钱包");
        return;
      }
      console.info("[tx] transferWithLog to", transferTo.trim(), "amount", transferAmount.trim());
      const browserProvider = new ethers.BrowserProvider(externalProvider);
      const signer = await browserProvider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.transferWithLog(transferTo.trim(), { value });
      setTransferHash(tx.hash);
      setTransferStatus(`交易已发送：${tx.hash}`);
      const receipt = await tx.wait();
      setTransferStatus(`转账完成：${receipt.hash}`);
      setTransferAmount("");
      await fetchLogs();
    } catch (error) {
      console.error(error);
      setTransferStatus(error.shortMessage || error.message || "转账失败");
    }
  };

  const fetchLogs = async () => {
    if (!SUBGRAPH_URL) return; // 缺少子图地址时不请求
    console.info("[subgraph] fetching from", SUBGRAPH_URL);
    setLoadingLogs(true);
    try {
      const data = await request(SUBGRAPH_URL, LOG_QUERY, { first: 20 }); // 调用子图
      console.info("[subgraph] data received", data);
      
      setLogs(data.logEntries || []); // 设置日志列表
      setTransfers(data.transferEntries || []); // 设置转账列表
    } catch (error) {
      console.error("[subgraph] fetch failed", error);
      setLogStatus("读取 Subgraph 失败，请检查 VITE_SUBGRAPH_URL");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs(); // 组件加载时自动读取子图
  }, []);

  useEffect(() => {
    const loadBalance = async () => {
      if (!account) {
        setBalance(""); // 未连接时清空
        return;
      }
      const externalProvider = metaMask.provider || provider || window.ethereum; // 选择可用 provider
      if (!externalProvider || typeof externalProvider.request !== "function") {
        setBalance("");
        return;
      }
      try {
        const browserProvider = new ethers.BrowserProvider(externalProvider); // 创建 BrowserProvider
        const raw = await browserProvider.getBalance(account); // 读取余额
        setBalance(parseFloat(ethers.formatEther(raw)).toFixed(4)); // 格式化为 ETH
      } catch (error) {
        console.error("Failed to load balance", error);
        setBalance(""); // 出错时清空
      }
    };
    loadBalance(); // 账户变化时重新读取余额
  }, [account, provider]);

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="eyebrow">Web3 → Event → The Graph</div>
          <h1>链上日志收集器</h1>
          <p>支持直接转账或调用合约写日志，并通过 The Graph 实时读取事件数据。</p>
        </div>
        <div className="wallet">
          {isActive ? (
            <>
              <span className="badge success">{networkOk ? "已连接" : "网络不匹配"}</span>
              <div className="address">{formatHex(account ?? "")}</div>
              {balance && <div className="address">余额: {balance} ETH</div>}
              <button className="ghost" onClick={disconnectWallet}>
                断开
              </button>
            </>
          ) : (
            <button className="primary" disabled={isActivating} onClick={connectWallet}>
              {isActivating ? "连接中..." : "连接 MetaMask"}
            </button>
          )}
        </div>
      </header>

      {!CONTRACT_ADDRESS && (
        <div className="alert">请设置环境变量 VITE_CONTRACT_ADDRESS（部署后的合约地址）。</div>
      )}
      {!SUBGRAPH_URL && <div className="alert">请设置 VITE_SUBGRAPH_URL（部署的 subgraph endpoint）。</div>}
      {!networkOk && <div className="alert">请切换到目标网络：链 ID {TARGET_CHAIN_ID}</div>}

      <TransferForm
        isActive={isActive}
        networkOk={networkOk}
        transferTo={transferTo}
        transferAmount={transferAmount}
        onChangeTo={setTransferTo}
        onChangeAmount={setTransferAmount}
        onSubmit={sendTransfer}
        transferHash={transferHash}
        transferStatus={transferStatus}
      />

      <LogForm
        isActive={isActive}
        networkOk={networkOk}
        input={input}
        onChange={setInput}
        onSubmit={sendLog}
        txHash={txHash}
        logStatus={logStatus}
      />

      <section className="card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Step 3</div>
            <h3>从 The Graph 读取</h3>
          </div>
          <button className="ghost" onClick={fetchLogs} disabled={loadingLogs}>
            {loadingLogs ? "刷新中..." : "刷新"}
          </button>
        </div>
        <div className="subsection">
          <div className="eyebrow">合约日志</div>
          <div className="grid">
            {logs.map((log) => (
              <article className="item" key={log.id}>
                <div className="item-row">
                  <span className="pill">ID {log.id}</span>
                  <span className="pill muted">链 ID {log.chainId}</span>
                </div>
                <div className="item-data">{log.data}</div>
                <div className="item-meta">
                  <div>
                    <span className="label">Sender</span>
                    <span className="value">{formatHex(log.sender)}</span>
                  </div>
                  <div>
                    <span className="label">Tx</span>
                    <a
                      className="value link"
                      href={`https://sepolia.etherscan.io/tx/${log.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {formatHex(log.txHash)}
                    </a>
                  </div>
                </div>
                <div className="item-footer">
                  <span className="label">Contract</span>
                  <span className="value">{formatHex(log.contractAddress)}</span>
                  <span className="time">
                    {new Date(Number(log.timestamp) * 1000).toLocaleString()}
                  </span>
                </div>
              </article>
            ))}
            {!loadingLogs && logs.length === 0 && <div className="empty">暂无日志，先写一条吧。</div>}
          </div>
        </div>

        <div className="subsection">
          <div className="eyebrow">转账记录</div>
          <div className="grid">
            {transfers.map((t) => (
              <article className="item" key={t.id}>
                <div className="item-row">
                  <span className="pill">{ethers.formatEther(t.amount || "0")} ETH</span>
                  <span className="pill muted">链 ID {t.chainId}</span>
                </div>
                <div className="item-meta">
                  <div>
                    <span className="label">From</span>
                    <span className="value">{formatHex(t.from)}</span>
                  </div>
                  <div>
                    <span className="label">To</span>
                    <span className="value">{formatHex(t.to)}</span>
                  </div>
                </div>
                <div className="item-footer">
                  <span className="label">Tx</span>
                  <a
                    className="value link"
                    href={`https://sepolia.etherscan.io/tx/${t.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {formatHex(t.txHash)}
                  </a>
                  <span className="time">{new Date(Number(t.timestamp) * 1000).toLocaleString()}</span>
                </div>
              </article>
            ))}
            {!loadingLogs && transfers.length === 0 && (
              <div className="empty">暂无转账记录，先转一笔吧。</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
