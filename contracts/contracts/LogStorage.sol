// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LogStorage
/// @notice Minimal contract that writes data on-chain and emits an event for indexing.
contract LogStorage {
    uint256 public nextId;

    event DataLogged(address indexed sender, uint256 indexed id, string data, uint256 timestamp);

    /// @notice Writes arbitrary data to the chain via an indexed log.
    /// @param data The string payload to record.
    /// @return id The monotonic id associated with this log entry.
    function logData(string calldata data) external returns (uint256 id) {
        id = ++nextId;
        emit DataLogged(msg.sender, id, data, block.timestamp);
    }
}
