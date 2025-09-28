const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Market 1 Configuration ===\n");

    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("📍 Market Address:", MARKET);

    // Get market configuration - correct hash structure
    // For market data: keccak256(abi.encode(bytes32 constant, address market))

    // Check index token
    const INDEX_TOKEN_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["INDEX_TOKEN"])
    );
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [INDEX_TOKEN_KEY, MARKET]
        )
    );
    const indexToken = await dataStore.getAddress(indexTokenKey);
    console.log("\n📍 Market Tokens:");
    console.log(`  Index Token: ${indexToken}`);
    console.log(`    Is sNGN: ${indexToken.toLowerCase() === sNGN.toLowerCase() ? "✅" : "❌"}`);

    // Check long token
    const LONG_TOKEN_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["LONG_TOKEN"])
    );
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [LONG_TOKEN_KEY, MARKET]
        )
    );
    const longToken = await dataStore.getAddress(longTokenKey);
    console.log(`  Long Token: ${longToken}`);
    console.log(`    Is USDT: ${longToken.toLowerCase() === USDT.toLowerCase() ? "✅" : "❌"}`);

    // Check short token
    const SHORT_TOKEN_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["SHORT_TOKEN"])
    );
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [SHORT_TOKEN_KEY, MARKET]
        )
    );
    const shortToken = await dataStore.getAddress(shortTokenKey);
    console.log(`  Short Token: ${shortToken}`);
    console.log(`    Is sNGN: ${shortToken.toLowerCase() === sNGN.toLowerCase() ? "✅" : "❌"}`);

    // Check if market is enabled
    const IS_MARKET_DISABLED_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_MARKET_DISABLED"])
    );
    const marketDisabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_MARKET_DISABLED_KEY, MARKET]
        )
    );
    const isDisabled = await dataStore.getBool(marketDisabledKey);
    console.log(`\n📍 Market Status:`);
    console.log(`  Enabled: ${!isDisabled ? "✅" : "❌"}`);

    // Check pool amounts
    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );

    const usdtPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, USDT]
        )
    );
    const usdtPoolAmount = await dataStore.getUint(usdtPoolKey);

    const sngnPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, sNGN]
        )
    );
    const sngnPoolAmount = await dataStore.getUint(sngnPoolKey);

    console.log(`\n📍 Current Pool Amounts:`);
    console.log(`  USDT: ${ethers.utils.formatUnits(usdtPoolAmount, 6)}`);
    console.log(`  sNGN: ${ethers.utils.formatUnits(sngnPoolAmount, 18)}`);

    // Check market token supply
    try {
        const marketToken = await ethers.getContractAt("MarketToken", MARKET);
        const totalSupply = await marketToken.totalSupply();
        console.log(`\n📍 Market Token Supply: ${ethers.utils.formatEther(totalSupply)}`);
    } catch (e) {
        console.log(`\n📍 Market Token Supply: Unable to check`);
    }

    // Summary
    console.log("\n=== Analysis ===");
    if (indexToken === ethers.constants.AddressZero ||
        longToken === ethers.constants.AddressZero ||
        shortToken === ethers.constants.AddressZero) {
        console.log("❌ Market not properly configured in DataStore!");
        console.log("This market may not have been initialized yet.");
    } else {
        console.log("✅ Market configuration found");
        console.log("\nExpected:");
        console.log("  Index: sNGN");
        console.log("  Long: USDT");
        console.log("  Short: sNGN");
    }
}

main().catch(console.error);