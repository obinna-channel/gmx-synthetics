const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Decrease-Specific Settings ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check all decrease-related feature flags
    console.log("🚦 Feature Flags:");

    const features = [
        "EXEC_ORDER_FEATURE_DISABLED",
        "DECREASE_ORDER_FEATURE_DISABLED",
        "DECREASE_POSITION_FEATURE_DISABLED",
        "CANCEL_ORDER_FEATURE_DISABLED"
    ];

    for (const feature of features) {
        const key = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], [feature])
        );
        const disabled = await dataStore.getBool(key);
        console.log(`  ${feature}: ${disabled ? "❌ DISABLED" : "✅ Enabled"}`);
    }

    // Check decrease swap type
    console.log("\n💱 Decrease Swap Configuration:");
    
    // Check if swap is required
    const DECREASE_POSITION_SWAP_TYPE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DECREASE_POSITION_SWAP_TYPE"])
    );
    
    const swapType = await dataStore.getUint(DECREASE_POSITION_SWAP_TYPE);
    console.log("  Decrease position swap type:", swapType.toString());
    if (swapType.eq(0)) console.log("    (NoSwap)");
    else if (swapType.eq(1)) console.log("    (SwapPnlTokenToCollateralToken)");
    else if (swapType.eq(2)) console.log("    (SwapCollateralTokenToPnlToken)");

    // Check if there's a minimum execution fee
    console.log("\n💸 Execution Fees:");
    
    const MIN_EXECUTION_FEE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_EXECUTION_FEE"])
    );
    const minFee = await dataStore.getUint(MIN_EXECUTION_FEE);
    console.log("  Min execution fee:", ethers.utils.formatEther(minFee), "ETH");

    // Check collateral factor for market
    console.log("\n📊 Collateral Factors:");
    
    const MIN_COLLATERAL_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_COLLATERAL_FACTOR"])
    );
    
    const collateralFactorKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MIN_COLLATERAL_FACTOR, MARKET]
        )
    );
    const collateralFactor = await dataStore.getUint(collateralFactorKey);
    console.log("  Min collateral factor:", collateralFactor.toString());
    
    // For long positions specifically
    const MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST_LONG"])
    );
    
    const longCollateralKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST, MARKET]
        )
    );
    const longCollateralFactor = await dataStore.getUint(longCollateralKey);
    console.log("  Min collateral factor for longs:", longCollateralFactor.toString());

    // Check if there's an issue with PnL
    console.log("\n💰 PnL Settings:");
    
    const MAX_PNL_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PNL_FACTOR_FOR_TRADERS_LONG"])
    );
    
    const maxPnlKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MAX_PNL_FACTOR, MARKET]
        )
    );
    const maxPnl = await dataStore.getUint(maxPnlKey);
    console.log("  Max PnL factor for longs:", maxPnl.toString());

    console.log("\n🔍 Most likely issue:");
    if (collateralFactor.gt(0)) {
        console.log("  ⚠️  Collateral factor requirements might be blocking the decrease");
    }
    console.log("  ⚠️  Or the position impact calculation is causing issues");
    console.log("  ⚠️  The empty impact pool could also be the problem");
}

main().catch(console.error);
