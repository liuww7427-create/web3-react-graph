import { useEffect, useMemo, useState } from "react";
import { gql, request } from "graphql-request";
import { ethers } from "ethers";
import { metaMask, metaMaskHooks } from "./connectors";

const { useAccount, useChainId, useIsActive, useIsActivating, useProvider } = metaMaskHooks;

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
  }
`;

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const SUBGRAPH_URL = import.meta.env.VITE_SUBGRAPH_URL || "";
const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 11155111); // default Sepolia

const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "string", name: "data", type: "string" }],
    name: "logData",
    outputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
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
  }
];

const formatHex = (value) => {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

function App() {
  const account = useAccount();
  const chainId = useChainId();
  const isActive = useIsActive();
  const isActivating = useIsActivating();
  const provider = useProvider();

  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [balance, setBalance] = useState("");

  const networkOk = useMemo(() => !isActive || chainId === TARGET_CHAIN_ID, [isActive, chainId]);

  const connectWallet = async () => {
    try {
      setStatus("连接钱包中...");
      await metaMask.activate(TARGET_CHAIN_ID);
      setStatus("已连接");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "连接失败");
    }
  };

  const disconnectWallet = async () => {
    metaMask.deactivate();
    metaMask.resetState();
    setStatus("");
  };

  const sendLog = async () => {
    if (!CONTRACT_ADDRESS) {
      setStatus("请先在 .env 设置 VITE_CONTRACT_ADDRESS");
      return;
    }
    if (!input.trim()) {
      setStatus("请输入要上链的内容");
      return;
    }
    try {
      setStatus("发送交易中...");
      const externalProvider = metaMask.provider || provider || window.ethereum;
      if (!externalProvider || typeof externalProvider.request !== "function") {
        setStatus("未获取到有效的钱包 provider，请先连接钱包");
        return;
      }
      const browserProvider = new ethers.BrowserProvider(externalProvider);
      const signer = await browserProvider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.logData(input.trim());
      setTxHash(tx.hash);
      setStatus(`交易已发送：${tx.hash}`);
      const receipt = await tx.wait();
      setStatus(`已上链：${receipt.hash}`);
      setInput("");
      await fetchLogs();
    } catch (error) {
      console.error(error);
      setStatus(error.shortMessage || error.message || "交易失败");
    }
  };

  const fetchLogs = async () => {
    if (!SUBGRAPH_URL) return;
    setLoadingLogs(true);
    try {
      const data = await request(SUBGRAPH_URL, LOG_QUERY, { first: 20 });
      setLogs(data.logEntries || []);
    } catch (error) {
      console.error(error);
      setStatus("读取 Subgraph 失败，请检查 VITE_SUBGRAPH_URL");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    const loadBalance = async () => {
      if (!account) {
        setBalance("");
        return;
      }
      const externalProvider = metaMask.provider || provider || window.ethereum;
      if (!externalProvider || typeof externalProvider.request !== "function") {
        setBalance("");
        return;
      }
      try {
        const browserProvider = new ethers.BrowserProvider(externalProvider);
        const raw = await browserProvider.getBalance(account);
        setBalance(parseFloat(ethers.formatEther(raw)).toFixed(4));
      } catch (error) {
        console.error("Failed to load balance", error);
        setBalance("");
      }
    };
    loadBalance();
  }, [account, provider]);

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="eyebrow">Web3 → Event → The Graph</div>
          <h1>链上日志收集器</h1>
          <p>写入数据到合约并通过 The Graph 实时读取，获取合约地址和交易哈希。</p>
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

      <section className="card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Step 1</div>
            <h3>写入链上</h3>
          </div>
          {txHash && (
            <a
              className="link"
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              最近交易
            </a>
          )}
        </div>
        <div className="form">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入要写入日志的文本"
            disabled={!isActive || !networkOk}
          />
          <button className="primary" onClick={sendLog} disabled={!isActive || !networkOk}>
            发送
          </button>
        </div>
        {status && <div className="status">{status}</div>}
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Step 2</div>
            <h3>从 The Graph 读取</h3>
          </div>
          <button className="ghost" onClick={fetchLogs} disabled={loadingLogs}>
            {loadingLogs ? "刷新中..." : "刷新"}
          </button>
        </div>
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
          {!loadingLogs && logs.length === 0 && <div className="empty">暂无数据，先写一条吧。</div>}
        </div>
      </section>
    </div>
  );
}

export default App;
