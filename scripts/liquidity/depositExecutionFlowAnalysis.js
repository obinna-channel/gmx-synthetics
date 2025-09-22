const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== COMPLETE DEPOSIT EXECUTION FLOW ANALYSIS ===");

    console.log("\n📋 DEPOSIT EXECUTION FLOW:");
    console.log("1. DepositHandler.executeDeposit() - Entry point");
    console.log("   - Requires ORDER_KEEPER role");
    console.log("   - Sets oracle prices");
    console.log("   - Calls _executeDeposit with gas limit");

    console.log("\n2. ExecuteDepositUtils.executeDeposit() - Main logic");
    console.log("   - Removes deposit from store");
    console.log("   - Validates oracle timestamps");
    console.log("   - Gets market configuration");
    console.log("   - Calls _validateFirstDeposit (checks min tokens if first deposit)");
    console.log("   - Gets market prices from oracle");
    console.log("   - Distributes position impact pool");
    console.log("   - Updates funding and borrowing state");
    console.log("   - Validates max PnL factor");
    console.log("   - Performs token swaps if needed");
    console.log("   - Calculates price impact");
    console.log("   - Calls _executeDeposit for each token");

    console.log("\n3. ExecuteDepositUtils._executeDeposit() - Token processing");
    console.log("   - Calculates swap fees");
    console.log("   - 🔴 CRITICAL: Gets pool value via MarketUtils.getPoolValueInfo()");
    console.log("   - 🔴 VALIDATION: Reverts if poolValue < 0 (line 355-357)");
    console.log("   - 🔴 VALIDATION: Reverts if poolValue == 0 && supply > 0 (line 363-365)");
    console.log("   - Applies price impact");
    console.log("   - Adds tokens to pool");
    console.log("   - Mints GM tokens");

    console.log("\n4. MarketUtils.getPoolValueInfo() - Pool value calculation");
    console.log("   Pool Value = ");
    console.log("     + longTokenAmount * longTokenPrice");
    console.log("     + shortTokenAmount * shortTokenPrice");
    console.log("     + totalBorrowingFees * poolFactor");
    console.log("     - netPnL (longPnL + shortPnL)");
    console.log("   🔴 - impactPoolAmount * indexTokenPrice (line 395)");
    console.log("     + lentImpactPoolAmount * indexTokenPrice");

    console.log("\n=== THE PROBLEM ===");
    console.log("For first deposit with empty pool:");
    console.log("- longTokenAmount = 0 (pool is empty)");
    console.log("- shortTokenAmount = 0 (pool is empty)");
    console.log("- borrowingFees = 0 (no positions)");
    console.log("- netPnL = 0 (no positions)");
    console.log("- lentImpactPoolAmount = 0");
    console.log("- BUT impactPoolAmount might NOT be 0!");

    console.log("\n❌ If impactPoolAmount > 0:");
    console.log("   poolValue = 0 - (impactPoolAmount * indexTokenPrice)");
    console.log("   poolValue < 0 → InvalidPoolValueForDeposit!");

    console.log("\n=== CURRENT STATE CHECK ===");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check pool amounts
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("\nCurrent USDT pool amount:", ethers.utils.formatUnits(poolAmount, 6), "USDT");

    // Check POSITION_IMPACT_POOL_AMOUNT
    const impactPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POSITION_IMPACT_POOL_AMOUNT")), MARKET]
        )
    );
    const impactPoolAmount = await dataStore.getUint(impactPoolAmountKey);
    console.log("Position impact pool amount:", impactPoolAmount.toString());

    // Check NEXT_POSITION_IMPACT_POOL_AMOUNT
    const nextImpactPoolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("NEXT_POSITION_IMPACT_POOL_AMOUNT")), MARKET]
        )
    );
    const nextImpactPoolAmount = await dataStore.getUint(nextImpactPoolAmountKey);
    console.log("Next position impact pool amount:", nextImpactPoolAmount.toString());

    // Check market token configuration
    const indexTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "bytes32"],
            [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INDEX_TOKEN"))]
        )
    );
    const indexToken = await dataStore.getAddress(indexTokenKey);
    console.log("\nIndex token configured:", indexToken);
    console.log("Expected sNGN:", sNGN);
    console.log("Index token is sNGN:", indexToken.toLowerCase() === sNGN.toLowerCase());

    console.log("\n=== SOLUTIONS ===");
    console.log("\n1. RESET IMPACT POOLS (Quick Fix):");
    console.log("   Set POSITION_IMPACT_POOL_AMOUNT to 0");
    console.log("   Set NEXT_POSITION_IMPACT_POOL_AMOUNT to 0");

    console.log("\n2. BOOTSTRAP POOL (Alternative):");
    console.log("   Add initial liquidity to pool before deposit");
    console.log("   This ensures poolValue > impactPoolAmount * price");

    console.log("\n3. RECONFIGURE MARKET (If index token is wrong):");
    console.log("   For USDT/NGN market, consider USDT as index token");
    console.log("   Currently sNGN is index token");

    console.log("\n=== KEY INSIGHT ===");
    console.log("The impactPoolAmount is in INDEX TOKEN units!");
    console.log("With sNGN as index token:");
    console.log("- impactPoolAmount is in sNGN units");
    console.log("- Multiplied by sNGN price for USD value");
    console.log("- If sNGN price is high (e.g., 1500), even small amounts create large USD deductions");

    console.log("\n✅ RECOMMENDED ACTION:");
    if (impactPoolAmount.gt(0) || nextImpactPoolAmount.gt(0)) {
        console.log("Reset impact pool amounts to 0 for clean first deposit");
    } else {
        console.log("Impact pools already at 0 - deposit should work!");
        console.log("If still failing, check oracle prices and other validations");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });