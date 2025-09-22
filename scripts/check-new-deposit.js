const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking NEW Deposit Details ===\n");
    
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const NEW_DEPOSIT_KEY = "0xa086d3ac59bbab5dfeb369072a8f0b04f6cade27fb9324d7d2ec165c937884aa";
    
    const reader = await ethers.getContractAt("Reader", READER);
    
    console.log("📝 NEW DEPOSIT KEY:", NEW_DEPOSIT_KEY);
    
    try {
        const deposit = await reader.getDeposit(DATA_STORE, NEW_DEPOSIT_KEY);
        
        console.log("\n✅ DEPOSIT EXISTS! Details:");
        console.log("  Account:", deposit.addresses.account);
        console.log("  Receiver:", deposit.addresses.receiver);
        console.log("  Market:", deposit.addresses.market);
        console.log("  Initial Long Token:", deposit.addresses.initialLongToken);
        console.log("  Initial Short Token:", deposit.addresses.initialShortToken);
        console.log("  Long Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
        console.log("  Short Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");
        console.log("  Execution Fee:", deposit.numbers.executionFee.toString());
        console.log("  Min Market Tokens:", deposit.numbers.minMarketTokens.toString());
        
        const updatedAt = deposit.numbers.updatedAtTime;
        const currentTime = Math.floor(Date.now() / 1000);
        const age = currentTime - updatedAt;
        const remaining = 3600 - age; // REQUEST_EXPIRATION_TIME is 3600
        
        console.log("\n⏰ TIMING:");
        console.log("  Created at:", new Date(updatedAt * 1000).toISOString());
        console.log("  Age:", Math.floor(age / 60), "minutes", age % 60, "seconds");
        console.log("  Time remaining:", Math.floor(remaining / 60), "minutes", remaining % 60, "seconds");
        
        console.log("\n✅ This is the ACTIVE deposit that needs to be executed!");
        console.log("   Key to use:", NEW_DEPOSIT_KEY);
        
    } catch (error) {
        console.log("  ❌ Error reading deposit:", error.message);
    }
}

main().catch(console.error);
