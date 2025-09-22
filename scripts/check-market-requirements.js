const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Market Token First Mint Requirements ===\n");
    
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DATA_STORE = "0xb6840dd443cd484ff8f89cf7d766549b768db21f";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dba0326623dece1712581271ebcd846d67b29f";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    
    console.log("Market token:", MARKET);
    console.log("Current supply:", await marketToken.totalSupply(), "(should be 0)\n");
    
    // Check if market is registered
    console.log("1. Checking if market is registered:");
    const MARKET_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_LIST"])
    );
    
    const marketCount = await dataStore.getAddressCount(MARKET_LIST);
    console.log("   Total markets:", marketCount.toString());
    
    const markets = await dataStore.getAddressValuesAt(MARKET_LIST, 0, marketCount);
    const isRegistered = markets.includes(MARKET.toLowerCase());
    console.log("   Market registered:", isRegistered ? "✅ YES" : "❌ NO");
    
    // Check market configuration
    console.log("\n2. Checking market configuration:");
    
    // Long token
    const MARKET_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_TOKEN"])
    );
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [MARKET_TOKEN, MARKET])
    );
    const longToken = await dataStore.getAddress(longTokenKey);
    console.log("   Long token:", longToken === USDT.toLowerCase() ? "✅ USDT" : longToken);
    
    // Short token  
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["SHORT_TOKEN"])),
                MARKET
            ]
        )
    );
    const shortToken = await dataStore.getAddress(shortTokenKey);
    console.log("   Short token:", shortToken === USDT.toLowerCase() ? "✅ USDT" : shortToken);
    
    // Index token
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INDEX_TOKEN"])),
                MARKET
            ]
        )
    );
    const indexToken = await dataStore.getAddress(indexTokenKey);
    console.log("   Index token:", indexToken === sNGN.toLowerCase() ? "✅ sNGN" : indexToken);
    
    // Check pool amounts
    console.log("\n3. Checking pool amounts:");
    const POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    
    const longPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "address"], [POOL_AMOUNT, MARKET, USDT])
    );
    const longPoolAmount = await dataStore.getUint(longPoolKey);
    console.log("   Long pool (USDT):", ethers.utils.formatUnits(longPoolAmount, 6));
    
    const shortPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "address"], [POOL_AMOUNT, MARKET, USDT])
    );
    const shortPoolAmount = await dataStore.getUint(shortPoolKey);
    console.log("   Short pool (USDT):", ethers.utils.formatUnits(shortPoolAmount, 6));
    
    // Check minimum liquidity for first deposit
    console.log("\n4. Checking minimum liquidity requirements:");
    
    // This might be the issue - GMX may require minimum liquidity
    const MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT"])
    );
    
    const minMarketTokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT, MARKET])
    );
    const minTokens = await dataStore.getUint(minMarketTokensKey);
    console.log("   MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT:", ethers.utils.formatEther(minTokens));
    
    if (minTokens.gt(0)) {
        console.log("   ⚠️ This could be blocking the first deposit!");
    }
    
    // Check if there's a minimum collateral requirement
    const MIN_COLLATERAL_USD = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_COLLATERAL_USD"])
    );
    const minCollateralKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [MIN_COLLATERAL_USD, MARKET])
    );
    const minCollateral = await dataStore.getUint(minCollateralKey);
    console.log("\n   MIN_COLLATERAL_USD:", ethers.utils.formatUnits(minCollateral, 30), "USD");
    
    // Check reserve factor
    const RESERVE_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["RESERVE_FACTOR"])
    );
    const reserveFactorKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "bool"], [RESERVE_FACTOR, MARKET, true])
    );
    const reserveFactor = await dataStore.getUint(reserveFactorKey);
    console.log("   Reserve factor:", ethers.utils.formatUnits(reserveFactor, 30));
    
    console.log("\n5. Potential issues for first deposit:");
    if (minTokens.gt(0)) {
        console.log("   ❌ MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT is set - might block deposit");
    }
    if (minCollateral.gt(ethers.utils.parseUnits("100", 30))) {
        console.log("   ❌ MIN_COLLATERAL_USD > $100 - your deposit might be too small");
    }
    if (!isRegistered) {
        console.log("   ❌ Market not properly registered");
    }
    
    console.log("\n💡 The error 0x95b66fe9 might be a minimum liquidity check!");
}

main().catch(console.error);