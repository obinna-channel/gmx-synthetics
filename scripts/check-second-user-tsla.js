const { ethers } = require("hardhat");

async function main() {
    const TARGET_USER = "0xf327592181299C6fF754FE3121D2B26c0A25125B";
    const TSLA_MARKET = "0x8ae559448a1482faffC925eF6a233276588348Df";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mTSLA = "0x77d4DdD2E847592fb7710e342C0492A4b85655f4";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const REFERRAL_STORAGE = "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547";

    console.log("=== Checking TSLA SHORT Position Liquidation Status ===\n");
    console.log("User:", TARGET_USER);
    console.log("Market: TSLA\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Calculate position key for SHORT position
    const isLong = false;
    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [TARGET_USER, TSLA_MARKET, mUSD, isLong]
        )
    );

    console.log("Position Key:", positionKey);
    console.log();

    // Get position details
    const position = await reader.getPosition(DATA_STORE, positionKey);

    console.log("📊 Position Details:");
    console.log("   Side: SHORT");
    console.log("   Size:", ethers.utils.formatUnits(position.numbers.sizeInUsd, 30), "USD");
    console.log("   Collateral:", ethers.utils.formatUnits(position.numbers.collateralAmount, 6), "mUSD");
    console.log();

    // Get current TSLA price
    const tslaPrice = ethers.utils.parseUnits("409.60", 12);
    const usdPrice = ethers.utils.parseUnits("1", 24);

    const marketPrices = {
        indexTokenPrice: { min: tslaPrice, max: tslaPrice },
        longTokenPrice: { min: usdPrice, max: usdPrice },
        shortTokenPrice: { min: usdPrice, max: usdPrice }
    };

    const marketStruct = {
        marketToken: TSLA_MARKET,
        indexToken: mTSLA,
        longToken: mUSD,
        shortToken: mUSD
    };

    console.log("💰 Using Prices:");
    console.log("   TSLA: $409.60");
    console.log("   mUSD: $1.00\n");

    // Check liquidation status
    const [isLiquidatable, reason, info] = await reader.isPositionLiquidatable(
        DATA_STORE,
        REFERRAL_STORAGE,
        positionKey,
        marketStruct,
        marketPrices,
        true,
        true
    );

    console.log("=".repeat(80));
    console.log("\n🔍 LIQUIDATION CHECK RESULT:\n");

    if (isLiquidatable) {
        console.log("❌ POSITION IS LIQUIDATABLE!\n");
        console.log("Reason:", reason);
        console.log();
        console.log("📉 Collateral Analysis:");
        console.log("   Remaining Collateral USD:", ethers.utils.formatUnits(info.remainingCollateralUsd, 30), "USD");
        console.log("   Min Collateral USD:", ethers.utils.formatUnits(info.minCollateralUsd, 30), "USD");
        console.log("   Min Collateral for Leverage:", ethers.utils.formatUnits(info.minCollateralUsdForLeverage, 30), "USD");
        console.log();
        console.log("💀 This position should be liquidated!");
    } else {
        console.log("✅ Position is NOT liquidatable\n");
        console.log("📊 Collateral Health:");
        console.log("   Remaining Collateral USD:", ethers.utils.formatUnits(info.remainingCollateralUsd, 30), "USD");
        console.log("   Min Collateral USD:", ethers.utils.formatUnits(info.minCollateralUsd, 30), "USD");
        console.log("   Min Collateral for Leverage:", ethers.utils.formatUnits(info.minCollateralUsdForLeverage, 30), "USD");
    }

    console.log();
}

main().catch(console.error);
