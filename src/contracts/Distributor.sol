// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Distributor {
    address public owner;
    
    event Distribution(address indexed from, address[] to, uint256[] amounts);
    event EthReceived(address indexed from, uint256 amount);
    
    constructor() {
        owner = msg.sender;
    }
    
    // 接收ETH的回调函数
    receive() external payable {
        emit EthReceived(msg.sender, msg.value);
    }
    
    // 批量分发ETH
    function distributeEth(address[] calldata _recipients, uint256[] calldata _amounts) external payable {
        require(_recipients.length == _amounts.length, "Recipients and amounts length mismatch");
        require(_recipients.length > 0, "Empty recipients array");
        
        uint256 totalAmount = 0;
        for(uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }
        
        require(msg.value >= totalAmount, "Insufficient ETH sent");
        
        for(uint256 i = 0; i < _recipients.length; i++) {
            require(_recipients[i] != address(0), "Invalid recipient address");
            (bool success, ) = _recipients[i].call{value: _amounts[i]}("");
            require(success, "Transfer failed");
        }
        
        // 如果发送的ETH超过需要分发的金额，将剩余的退回
        uint256 remaining = msg.value - totalAmount;
        if (remaining > 0) {
            (bool success, ) = msg.sender.call{value: remaining}("");
            require(success, "Refund failed");
        }
        
        emit Distribution(msg.sender, _recipients, _amounts);
    }
    
    // 查询合约ETH余额
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // 紧急提款函数（仅限owner）
    function emergencyWithdraw() external {
        require(msg.sender == owner, "Only owner");
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = owner.call{value: balance}("");
        require(success, "Withdrawal failed");
    }
} 