const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Market Salt Configuration ===\n");
    
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DATA_STORE = "0xb6840dd443cd484ff8f89cf7d766549b768db21f";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // The salt would have been computed during market creation
    // From MarketFactory: salt = keccak256(abi.encode("GMX_MARKET", indexToken, longToken, shortToken, marketType))
    
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    // Try different market types
    const marketTypes = [
        ethers.constants.HashZero, // Default
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SPOT")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PERP")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PERPETUAL"))
    ];
    
    console.log("Looking for market salt with different market types:\n");
    
    for (const marketType of marketTypes) {
        // Compute the salt that would have been used
        const salt = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "address", "address", "bytes32"],
                ["GMX_MARKET", sNGN, USDT, USDT, marketType]
            )
        );
        
        // Get the market salt hash (from MarketStoreUtils.getMarketSaltHash)
        const MARKET_SALT = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_SALT"])
        );
        const marketSaltHash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [MARKET_SALT, salt])
        );
        
        // Check if this salt points to our market
        const marketAddress = await dataStore.getAddress(marketSaltHash);
        
        if (marketAddress.toLowerCase() === MARKET.toLowerCase()) {
            console.log("✅ FOUND! Market was created with:");
            console.log("   Salt:", salt);
            console.log("   Market type:", marketType === ethers.constants.HashZero ? "Default (0x0)" : marketType);
            console.log("   This confirms market was properly created via MarketFactory\n");
            return;
        }
    }
    
    console.log("❌ Could not find salt for this market");
    console.log("   This might mean:");
    console.log("   1. Market was not created through MarketFactory");
    console.log("   2. Market was created with different token order");
    console.log("   3. Market creation transaction didn't complete properly\n");
    
    // Check if market token exists and can be called
    console.log("Checking if market token contract is functional:");
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    try {
        const totalSupply = await marketToken.totalSupply();
        console.log("   Total supply:", totalSupply.toString());
        const name = await marketToken.name();
        console.log("   Name:", name);
        console.log("   ✅ Market token contract is responsive\n");
    } catch (e) {
        console.log("   ❌ Error calling market token:", e.message);
    }
}

main().catch(console.error);