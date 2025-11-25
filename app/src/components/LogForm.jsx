import React from "react";

// 方式二：调用合约 logData 写入日志
function LogForm({ isActive, networkOk, input, onChange, onSubmit, txHash, logStatus }) {
  return (
    <section className="card">
      <div className="section-header">
        <div>
          <div className="eyebrow">方式二 / Step 2</div>
          <h3>调用合约写日志</h3>
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
          onChange={(e) => onChange(e.target.value)}
          placeholder="输入要写入日志的文本"
          disabled={!isActive || !networkOk}
        />
        <button className="primary" onClick={onSubmit} disabled={!isActive || !networkOk}>
          发送
        </button>
      </div>
      {logStatus && <div className="status">{logStatus}</div>}
    </section>
  );
}

export default LogForm;
