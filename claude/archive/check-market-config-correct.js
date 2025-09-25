const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Market Configuration (Correct Method) ===\n");
    
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DATA_STORE = "0xb6840dd443cd484ff8f89cf7d766549b768db21f";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("Market address:", MARKET);
    
    // Check if market is in the list
    const MARKET_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_LIST"])
    );
    
    const marketCount = await dataStore.getAddressCount(MARKET_LIST);
    const markets = await dataStore.getAddressValuesAt(MARKET_LIST, 0, marketCount);
    console.log("Registered markets:", markets);
    console.log("Market is registered:", markets.includes(MARKET.toLowerCase()) ? "✅ YES" : "❌ NO\n");
    
    // Use the correct storage key construction (from MarketStoreUtils.sol)
    // keccak256(abi.encode(key, TOKEN_TYPE)) where key is the market address
    
    console.log("\nMarket configuration:");
    
    // Market token
    const MARKET_TOKEN = ethers.utils.solidityKeccak256(
        ["string"],
        ["MARKET_TOKEN"]
    );
    const marketTokenKey = ethers.utils.solidityKeccak256(
        ["address", "bytes32"],
        [MARKET, MARKET_TOKEN]
    );
    const marketToken = await dataStore.getAddress(marketTokenKey);
    console.log("  Market token:", marketToken);
    
    // Index token
    const INDEX_TOKEN = ethers.utils.solidityKeccak256(
        ["string"],
        ["INDEX_TOKEN"]
    );
    const indexTokenKey = ethers.utils.solidityKeccak256(
        ["address", "bytes32"],
        [MARKET, INDEX_TOKEN]
    );
    const indexToken = await dataStore.getAddress(indexTokenKey);
    console.log("  Index token:", indexToken);
    
    // Long token
    const LONG_TOKEN = ethers.utils.solidityKeccak256(
        ["string"],
        ["LONG_TOKEN"]
    );
    const longTokenKey = ethers.utils.solidityKeccak256(
        ["address", "bytes32"],
        [MARKET, LONG_TOKEN]
    );
    const longToken = await dataStore.getAddress(longTokenKey);
    console.log("  Long token:", longToken);
    
    // Short token
    const SHORT_TOKEN = ethers.utils.solidityKeccak256(
        ["string"],
        ["SHORT_TOKEN"]
    );
    const shortTokenKey = ethers.utils.solidityKeccak256(
        ["address", "bytes32"],
        [MARKET, SHORT_TOKEN]
    );
    const shortToken = await dataStore.getAddress(shortTokenKey);
    console.log("  Short token:", shortToken);
    
    // Check expected values
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6".toLowerCase();
    const sNGN = "0xe0dba0326623dece1712581271ebcd846d67b29f".toLowerCase();
    
    console.log("\n✅ Expected configuration:");
    console.log("  Market token should be:", MARKET.toLowerCase());
    console.log("  Index token should be:", sNGN);
    console.log("  Long token should be:", USDT);
    console.log("  Short token should be:", USDT);
    
    console.log("\n📊 Configuration status:");
    if (marketToken === MARKET.toLowerCase()) {
        console.log("  ✅ Market token is correct");
    } else {
        console.log("  ❌ Market token mismatch");
    }
    
    if (indexToken === sNGN) {
        console.log("  ✅ Index token is sNGN");
    } else {
        console.log("  ❌ Index token mismatch");
    }
    
    if (longToken === USDT) {
        console.log("  ✅ Long token is USDT");
    } else {
        console.log("  ❌ Long token mismatch");
    }
    
    if (shortToken === USDT) {
        console.log("  ✅ Short token is USDT");
    } else {
        console.log("  ❌ Short token mismatch");
    }
    
    // If all zeros, market is not configured
    if (marketToken === "0x0000000000000000000000000000000000000000" &&
        indexToken === "0x0000000000000000000000000000000000000000" &&
        longToken === "0x0000000000000000000000000000000000000000" &&
        shortToken === "0x0000000000000000000000000000000000000000") {
        console.log("\n❌ MARKET HAS NO CONFIGURATION AT ALL!");
        console.log("This market was added to the list but never configured.");
    }
}

main().catch(console.error);