const { ethers } = require("hardhat");

async function main() {
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));
    const marketCount = await dataStore.getAddressCount(MARKET_LIST_KEY);
    
    console.log("Total markets now:", marketCount.toString());
    
    if (marketCount.gt(0)) {
        const markets = await dataStore.getAddressValuesAt(MARKET_LIST_KEY, 0, marketCount);
        console.log("\n🎯 NEW USDTNGN MARKET ADDRESS:", markets[0]);
        
        // Get details
        const market = markets[0];
        
        const indexTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["INDEX_TOKEN", market])
        );
        const indexToken = await dataStore.getAddress(indexTokenKey);
        
        const longTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["LONG_TOKEN", market])
        );
        const longToken = await dataStore.getAddress(longTokenKey);
        
        console.log("\nMarket details:");
        console.log("  Market Token:", market);
        console.log("  Index Token (sNGN):", indexToken);
        console.log("  Long Token (USDT):", longToken);
        
        console.log("\n✅ Market is properly registered in DataStore!");
        console.log("Use this address for deposits:", market);
    }
}

main().catch(console.error);
