const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING MARKET CONTRACT TYPE ===\n");
    
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const MARKET_FACTORY = "0x6691AFCa903E83996493283ab827DE22E9018959";
    
    // Check if the market has the right bytecode size for a Market contract
    const code = await ethers.provider.getCode(MARKET);
    console.log("Market contract bytecode size:", code.length);
    
    // Try calling MarketFactory to see what the expected bytecode size should be
    const marketFactory = await ethers.getContractAt("MarketFactory", MARKET_FACTORY);
    
    // Check if there's a market salt stored (required for proper market)
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    const saltKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "address"], 
        [ethers.utils.id("MARKET_SALT"), MARKET])
    );
    const salt = await dataStore.getBytes32(saltKey);
    console.log("Market salt:", salt);
    
    // The real issue might be that createMarket created a minimal proxy
    // but didn't initialize it properly
    console.log("\nPossible issues:");
    console.log("1. Market is a proxy that needs initialization");
    console.log("2. Market Factory didn't deploy the right contract type");
    console.log("3. We need to check what MarketFactory actually deploys");
}

main().catch(console.error);
