const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Market Liquidity ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Pool amounts
    console.log("📊 Pool Amounts:");
    
    // USDT pool amount
    const POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    
    const usdtPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT, MARKET, USDT]
        )
    );
    const usdtPool = await dataStore.getUint(usdtPoolKey);
    console.log("  USDT pool:", ethers.utils.formatUnits(usdtPool, 6), "USDT");

    const sngnPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT, MARKET, sNGN]
        )
    );
    const sngnPool = await dataStore.getUint(sngnPoolKey);
    console.log("  sNGN pool:", ethers.utils.formatUnits(sngnPool, 18), "sNGN");

    // Impact pool amounts
    console.log("\n📉 Impact Pool Amounts:");
    const IMPACT_POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IMPACT_POOL_AMOUNT"])
    );

    const usdtImpactKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [IMPACT_POOL_AMOUNT, MARKET, USDT]
        )
    );
    const usdtImpact = await dataStore.getUint(usdtImpactKey);
    console.log("  USDT impact pool:", ethers.utils.formatUnits(usdtImpact, 6), "USDT");

    // Check swap impact factor
    console.log("\n⚡ Swap Impact Factors:");
    const SWAP_IMPACT_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["SWAP_IMPACT_FACTOR"])
    );

    const swapImpactKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [SWAP_IMPACT_FACTOR, MARKET]
        )
    );
    const swapImpact = await dataStore.getUint(swapImpactKey);
    console.log("  Swap impact factor:", swapImpact.toString());

    // Position impact factors
    const POSITION_IMPACT_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_IMPACT_FACTOR"])
    );

    const posImpactKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [POSITION_IMPACT_FACTOR, MARKET, true] // for long
        )
    );
    const posImpact = await dataStore.getUint(posImpactKey);
    console.log("  Position impact factor (long):", posImpact.toString());

    // Negative position impact
    const NEG_POSITION_IMPACT_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["NEGATIVE_POSITION_IMPACT_FACTOR"])
    );

    const negPosImpactKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [NEG_POSITION_IMPACT_FACTOR, MARKET, true] // for long
        )
    );
    const negPosImpact = await dataStore.getUint(negPosImpactKey);
    console.log("  Negative position impact factor (long):", negPosImpact.toString());

    // Max position impact factor
    const MAX_POSITION_IMPACT_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_POSITION_IMPACT_FACTOR_FOR_LIQUIDATIONS"])
    );
    const maxImpact = await dataStore.getUint(MAX_POSITION_IMPACT_FACTOR);
    console.log("  Max impact factor for liquidations:", maxImpact.toString());

    console.log("\n💡 Analysis:");
    if (usdtPool.eq(0)) {
        console.log("  ❌ USDT pool is empty! This could prevent decreases.");
    }
    if (sngnPool.eq(0)) {
        console.log("  ❌ sNGN pool is empty! This could prevent decreases.");
    }
    if (usdtPool.gt(0) && sngnPool.gt(0)) {
        console.log("  ✅ Both pools have liquidity");
        console.log("  ⚠️  But impact factors might be preventing the decrease");
    }
}

main().catch(console.error);
