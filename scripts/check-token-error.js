const { ethers } = require("hardhat");

async function main() {
    // Common ERC20 errors
    const errors = [
        "error InsufficientBalance(uint256 available, uint256 required)",
        "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
        "error InsufficientAllowance(uint256 available, uint256 required)",
    ];
    
    const targetSelector = "0xe73a05d5";
    
    console.log(`Looking for selector: ${targetSelector}\n`);
    
    for (const errorSig of errors) {
        const selector = ethers.utils.id(errorSig).slice(0, 10);
        console.log(`${selector} ${errorSig}`);
        if (selector === targetSelector) {
            console.log("  ✅ MATCH!");
        }
    }
    
    // The parameters suggest:
    // param1 = 1135417 (1.135417 mUSD with 6 decimals) - available
    // param2 = 1200000 (1.2 mUSD with 6 decimals) - required
    
    console.log("\n=== Analysis ===");
    console.log("Pool tried to send: 1.2 mUSD");
    console.log("Pool only had: 1.135417 mUSD");  
    console.log("Shortfall: 0.064583 mUSD");
    console.log("\nThis is an insufficient pool liquidity error!");
}

main().catch(console.error);
