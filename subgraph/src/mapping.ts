import { BigInt } from "@graphprotocol/graph-ts";
import { DataLogged, TransferLogged } from "../generated/LogStorage/LogStorage";
import { LogEntry, TransferEntry } from "../generated/schema";

// 处理合约日志事件，将字符串写入子图，方便前端按 id/tx 查询。
export function handleDataLogged(event: DataLogged): void {
  const id = event.params.id.toString();
  const entity = new LogEntry(id);

  entity.txHash = event.transaction.hash;
  entity.sender = event.params.sender;
  entity.data = event.params.data;
  entity.timestamp = event.block.timestamp;
  entity.contractAddress = event.address;
  entity.chainId = BigInt.fromI32(11155111); // Sepolia

  entity.save();
}

// 处理转账事件，将 transferWithLog 产生的转账记录写入子图。
export function handleTransferLogged(event: TransferLogged): void {
  const id = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const entity = new TransferEntry(id);

  entity.txHash = event.transaction.hash;
  entity.from = event.params.from;
  entity.to = event.params.to;
  entity.amount = event.params.amount;
  entity.timestamp = event.block.timestamp;
  entity.contractAddress = event.address;
  entity.chainId = BigInt.fromI32(11155111); // Sepolia

  entity.save();
}
