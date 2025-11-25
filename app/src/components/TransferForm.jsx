import React from "react";

// 方式一：直接转账（调用合约 transferWithLog）
function TransferForm({
  isActive,
  networkOk,
  transferTo,
  transferAmount,
  onChangeTo,
  onChangeAmount,
  onSubmit,
  transferHash,
  transferStatus
}) {
  return (
    <section className="card">
      <div className="section-header">
        <div>
          <div className="eyebrow">方式一 / Step 1</div>
          <h3>直接转账</h3>
        </div>
        {transferHash && (
          <a
            className="link"
            href={`https://sepolia.etherscan.io/tx/${transferHash}`}
            target="_blank"
            rel="noreferrer"
          >
            最近交易
          </a>
        )}
      </div>
      <div className="form transfer-form">
        <input
          value={transferTo}
          onChange={(e) => onChangeTo(e.target.value)}
          placeholder="接收地址（0x...）"
          disabled={!isActive || !networkOk}
        />
        <input
          value={transferAmount}
          onChange={(e) => onChangeAmount(e.target.value)}
          placeholder="金额 (ETH)"
          inputMode="decimal"
          disabled={!isActive || !networkOk}
        />
        <button className="primary" onClick={onSubmit} disabled={!isActive || !networkOk}>
          直接转账
        </button>
      </div>
      {transferStatus && <div className="status">{transferStatus}</div>}
    </section>
  );
}

export default TransferForm;
