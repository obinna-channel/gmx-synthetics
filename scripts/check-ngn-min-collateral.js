const { ethers } = require("hardhat");

async function main() {
    const NGN_MARKET = "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    console.log("=== NGN Market Collateral Requirements ===\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get min collateral factor
    const MIN_COLLATERAL_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_COLLATERAL_FACTOR"])
    );

    const minCollateralFactorKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MIN_COLLATERAL_FACTOR, NGN_MARKET]
        )
    );
    const minCollateralFactor = await dataStore.getUint(minCollateralFactorKey);

    // Get min collateral factor for liquidation
    const MIN_COLLATERAL_FACTOR_FOR_LIQUIDATION = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_COLLATERAL_FACTOR_FOR_LIQUIDATION"])
    );

    const minCollateralFactorForLiqKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MIN_COLLATERAL_FACTOR_FOR_LIQUIDATION, NGN_MARKET]
        )
    );
    const minCollateralFactorForLiq = await dataStore.getUint(minCollateralFactorForLiqKey);

    // Get min collateral USD
    const MIN_COLLATERAL_USD = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_COLLATERAL_USD"])
    );
    const minCollateralUsd = await dataStore.getUint(MIN_COLLATERAL_USD);

    console.log("📊 Collateral Factors:");
    console.log(`   Min Collateral Factor: ${ethers.utils.formatUnits(minCollateralFactor, 30)} (${(parseFloat(ethers.utils.formatUnits(minCollateralFactor, 30)) * 100).toFixed(2)}%)`);
    console.log(`      → Max Leverage: ${(1 / parseFloat(ethers.utils.formatUnits(minCollateralFactor, 30))).toFixed(2)}x`);
    console.log();
    console.log(`   Min Collateral Factor for Liquidation: ${ethers.utils.formatUnits(minCollateralFactorForLiq, 30)} (${(parseFloat(ethers.utils.formatUnits(minCollateralFactorForLiq, 30)) * 100).toFixed(2)}%)`);
    console.log(`      → Liquidation at: ${(1 / parseFloat(ethers.utils.formatUnits(minCollateralFactorForLiq, 30))).toFixed(2)}x leverage`);
    console.log();
    console.log(`   Min Collateral USD: $${ethers.utils.formatUnits(minCollateralUsd, 30)}`);
    console.log();

    // Test the failed order
    const orderSize = ethers.utils.parseUnits("4937.50", 30);
    const orderCollateral = ethers.utils.parseUnits("100", 6); // 100 mUSD

    console.log("=".repeat(80));
    console.log("\n💼 Analyzing Failed Order:\n");
    console.log("   Order Size: $4,937.50");
    console.log("   Collateral: $100");
    console.log("   Leverage:", (4937.50 / 100).toFixed(2) + "x");
    console.log();

    // Calculate min collateral required
    const minCollateralRequired = orderSize.mul(minCollateralFactor).div(ethers.BigNumber.from(10).pow(30));
    const minCollateralForLeverage = orderSize.mul(minCollateralFactor).div(ethers.BigNumber.from(10).pow(30));

    console.log("   Min Collateral Required:");
    console.log("      Based on minCollateralFactor:", ethers.utils.formatUnits(minCollateralRequired, 30), "USD");
    console.log();

    const collateralUsd = orderCollateral.mul(ethers.BigNumber.from(10).pow(24)); // Convert to precision 30

    if (collateralUsd.lt(minCollateralRequired)) {
        console.log("   ❌ FAILS MIN COLLATERAL CHECK");
        console.log("      Collateral provided: $" + ethers.utils.formatUnits(collateralUsd, 30));
        console.log("      Min required: $" + ethers.utils.formatUnits(minCollateralRequired, 30));
        console.log("      Shortage: $" + ethers.utils.formatUnits(minCollateralRequired.sub(collateralUsd), 30));
        console.log();
        console.log("   📝 To pass validation with this size, you need:");
        console.log("      Min collateral: $" + ethers.utils.formatUnits(minCollateralRequired, 30));
        console.log("      Current: $100");
        console.log("      Need to add: $" + (parseFloat(ethers.utils.formatUnits(minCollateralRequired, 30)) - 100).toFixed(2));
    } else {
        console.log("   ✅ PASSES min collateral check");
    }

    console.log();
    console.log("=".repeat(80));
    console.log("\n💡 Maximum Position Size with $100 Collateral:\n");

    const maxLeverage = 1 / parseFloat(ethers.utils.formatUnits(minCollateralFactor, 30));
    const maxSize = 100 * maxLeverage;

    console.log(`   Max Leverage: ${maxLeverage.toFixed(2)}x`);
    console.log(`   Max Position Size: $${maxSize.toFixed(2)}`);
    console.log();
    console.log(`   Your order size ($4,937.50) exceeds this by: $${(4937.50 - maxSize).toFixed(2)}`);
}

main().catch(console.error);
