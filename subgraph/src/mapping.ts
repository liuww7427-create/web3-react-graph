import { BigInt } from "@graphprotocol/graph-ts";
import { DataLogged } from "../generated/LogStorage/LogStorage";
import { LogEntry } from "../generated/schema";

// Persist each log to the subgraph so the front-end can query by id or tx hash.
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
