const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Market Configuration (With Proper Encoding) ===\n");
    
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DATA_STORE = "0xb6840dd443cd484ff8f89cf7d766549b768db21f";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("Market address:", MARKET);
    
    // The key difference: using abi.encode not just keccak256 of string
    // From MarketStoreUtils.sol:
    // bytes32 public constant MARKET_TOKEN = keccak256(abi.encode("MARKET_TOKEN"));
    
    console.log("\nUsing correct encoding (abi.encode):\n");
    
    // These constants match MarketStoreUtils.sol exactly
    const MARKET_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_TOKEN"])
    );
    const INDEX_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["INDEX_TOKEN"])
    );
    const LONG_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["LONG_TOKEN"])
    );
    const SHORT_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["SHORT_TOKEN"])
    );
    
    console.log("Constants (should match contract):");
    console.log("  MARKET_TOKEN:", MARKET_TOKEN);
    console.log("  INDEX_TOKEN:", INDEX_TOKEN);
    console.log("  LONG_TOKEN:", LONG_TOKEN);
    console.log("  SHORT_TOKEN:", SHORT_TOKEN);
    
    // Now create the storage keys using keccak256(abi.encode(market, constant))
    const marketTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, MARKET_TOKEN])
    );
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, INDEX_TOKEN])
    );
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, LONG_TOKEN])
    );
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["address", "bytes32"], [MARKET, SHORT_TOKEN])
    );
    
    console.log("\nStorage keys:");
    console.log("  marketTokenKey:", marketTokenKey);
    console.log("  indexTokenKey:", indexTokenKey);
    console.log("  longTokenKey:", longTokenKey);
    console.log("  shortTokenKey:", shortTokenKey);
    
    // Get the values
    const marketToken = await dataStore.getAddress(marketTokenKey);
    const indexToken = await dataStore.getAddress(indexTokenKey);
    const longToken = await dataStore.getAddress(longTokenKey);
    const shortToken = await dataStore.getAddress(shortTokenKey);
    
    console.log("\n📊 Market configuration:");
    console.log("  Market token:", marketToken);
    console.log("  Index token:", indexToken);
    console.log("  Long token:", longToken);
    console.log("  Short token:", shortToken);
    
    // Check if properly configured
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6".toLowerCase();
    const sNGN = "0xe0dba0326623dece1712581271ebcd846d67b29f".toLowerCase();
    
    if (marketToken === "0x0000000000000000000000000000000000000000") {
        console.log("\n❌ Market token is not set!");
    } else if (marketToken === MARKET.toLowerCase()) {
        console.log("\n✅ Market token is set correctly to itself");
    }
    
    if (indexToken === sNGN) {
        console.log("✅ Index token is sNGN");
    } else {
        console.log("❌ Index token is not sNGN:", indexToken);
    }
    
    if (longToken === USDT && shortToken === USDT) {
        console.log("✅ Long and short tokens are USDT");
    } else {
        console.log("❌ Tokens not configured correctly");
        console.log("  Expected USDT:", USDT);
        console.log("  Got long:", longToken);
        console.log("  Got short:", shortToken);
    }
}

main().catch(console.error);