// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// 合约：存储日志并记录带日志的转账
contract LogStorage {
    // 自增 ID
    uint256 public nextId;

    // 事件：日志写入
    event DataLogged(address indexed sender, uint256 indexed id, string data, uint256 timestamp);
    // 事件：转账写入
    event TransferLogged(address indexed from, address indexed to, uint256 amount, uint256 timestamp);

    // 写入字符串日志，返回新的自增 ID
    function logData(string calldata data) external returns (uint256 id) {
        // 递增 ID
        id = ++nextId;
        // 触发事件
        emit DataLogged(msg.sender, id, data, block.timestamp);
    }

    // 转账 ETH 并记录事件
    function transferWithLog(address payable to) external payable {
        // 校验转账金额
        require(msg.value > 0, "No value sent");
        // 校验接收地址
        require(to != address(0), "Invalid recipient");

        // 转出 ETH
        (bool ok, ) = to.call{value: msg.value}("");
        // 确认转账成功
        require(ok, "Transfer failed");

        // 触发转账事件
        emit TransferLogged(msg.sender, to, msg.value, block.timestamp);
    }
}
