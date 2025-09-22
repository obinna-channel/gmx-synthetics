const { ethers } = require("hardhat");

async function main() {
    console.log("=== FIXING MARKET KEY FORMAT ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // The correct key format is keccak256(abi.encode(marketAddress, "CONSTANT_NAME"))
    // We need to use the constant values from Keys.sol
    const MARKET_TOKEN = ethers.utils.id("MARKET_TOKEN");
    const INDEX_TOKEN = ethers.utils.id("INDEX_TOKEN");
    const LONG_TOKEN = ethers.utils.id("LONG_TOKEN");
    const SHORT_TOKEN = ethers.utils.id("SHORT_TOKEN");
    
    console.log("Setting market data with correct key format...\n");
    
    // Set MARKET_TOKEN
    const marketTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, MARKET_TOKEN])
    );
    await dataStore.setAddress(marketTokenKey, MARKET);
    console.log("✓ Set MARKET_TOKEN");
    
    // Set INDEX_TOKEN
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, INDEX_TOKEN])
    );
    await dataStore.setAddress(indexTokenKey, sNGN);
    console.log("✓ Set INDEX_TOKEN");
    
    // Set LONG_TOKEN
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, LONG_TOKEN])
    );
    await dataStore.setAddress(longTokenKey, USDT);
    console.log("✓ Set LONG_TOKEN");
    
    // Set SHORT_TOKEN
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, SHORT_TOKEN])
    );
    await dataStore.setAddress(shortTokenKey, USDT);
    console.log("✓ Set SHORT_TOKEN");
    
    // Verify
    console.log("\nVerifying...");
    const storedMarketToken = await dataStore.getAddress(marketTokenKey);
    const storedIndexToken = await dataStore.getAddress(indexTokenKey);
    const storedLongToken = await dataStore.getAddress(longTokenKey);
    const storedShortToken = await dataStore.getAddress(shortTokenKey);
    
    console.log("Market token:", storedMarketToken);
    console.log("Index token:", storedIndexToken);
    console.log("Long token:", storedLongToken);
    console.log("Short token:", storedShortToken);
}

main().catch(console.error);
