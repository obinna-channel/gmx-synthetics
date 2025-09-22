const { ethers } = require("hardhat");

async function main() {
    console.log("=== FINAL DIAGNOSTIC ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check if deposits are globally disabled
    const globalDisabledKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("IS_DEPOSIT_DISABLED"));
    const globalDisabled = await dataStore.getBool(globalDisabledKey);
    console.log("Deposits globally disabled:", globalDisabled);
    
    // Check ExchangeRouter code
    const routerCode = await ethers.provider.getCode(EXCHANGE_ROUTER);
    console.log("ExchangeRouter deployed:", routerCode !== "0x");
    
    console.log("\nSummary of what we've done:");
    console.log("✅ Created market through MarketFactory");
    console.log("✅ Registered market in DataStore");
    console.log("✅ Set max deposit amount");
    console.log("✅ Set market salt");
    console.log("✅ Set oracle prices");
    console.log("✅ Sent USDT to DepositVault (501 USDT there)");
    console.log("✅ Approved Router for spending");
    console.log("❌ createDeposit keeps reverting");
    
    console.log("\nPossible issues:");
    console.log("1. The market contract isn't a proper GMX v2 market token");
    console.log("2. Missing critical market parameters we haven't identified");
    console.log("3. The ExchangeRouter expects a different flow");
    console.log("4. There's a bug in the deployment");
    
    console.log("\nRecommendation:");
    console.log("Check the GMX v2 deployment scripts to see the exact");
    console.log("sequence and parameters needed for a working market.");
}

main().catch(console.error);
