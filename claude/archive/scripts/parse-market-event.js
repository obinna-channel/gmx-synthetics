const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x87518a50e5f4d56bed8f2d099e59875e414a877d83a29f620324494530d3c93a";
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    // The market address is in topics[2] for the MarketCreated event
    const log = receipt.logs[0];
    
    // topics[2] contains the market address (padded to 32 bytes)
    const marketAddress = "0x" + log.topics[2].slice(-40);
    
    console.log("🎯 NEW MARKET ADDRESS:", marketAddress);
    
    // Verify it exists
    const code = await ethers.provider.getCode(marketAddress);
    if (code !== "0x") {
        console.log("✅ Market contract deployed successfully!");
        
        // Now check if it's in DataStore
        const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
        const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
        
        const marketTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(["string", "address"], ["MARKET_TOKEN", marketAddress])
        );
        const storedMarket = await dataStore.getAddress(marketTokenKey);
        
        if (storedMarket === marketAddress) {
            console.log("✅ Market is registered in DataStore!");
        } else {
            console.log("⚠️  Market not found in DataStore yet");
            console.log("Stored value:", storedMarket);
        }
        
        console.log("\nUse this address for deposits:", marketAddress);
    }
}

main().catch(console.error);
