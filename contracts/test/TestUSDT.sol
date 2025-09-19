// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestUSDT is ERC20, Ownable {
    uint8 private _decimals;
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    // Mint function for testing
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
    
    // Burn function for testing
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}   