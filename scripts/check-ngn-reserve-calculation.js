const { ethers } = require("hardhat");

async function main() {
    const NGN_MARKET = "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb";
    const mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    console.log("=== NGN Market Reserve Calculation ===\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get current state
    const POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );

    const poolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT, NGN_MARKET, mUSD]
        )
    );
    const poolAmount = await dataStore.getUint(poolKey);

    // Get open interest in tokens
    const OPEN_INTEREST_IN_TOKENS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])
    );

    const longOITokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_IN_TOKENS, NGN_MARKET, mUSD, true]
        )
    );
    const longOITokens = await dataStore.getUint(longOITokensKey);

    // Get reserve factor
    const OPEN_INTEREST_RESERVE_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_RESERVE_FACTOR"])
    );

    const reserveFactorKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [OPEN_INTEREST_RESERVE_FACTOR, NGN_MARKET, true]
        )
    );
    const reserveFactor = await dataStore.getUint(reserveFactorKey);

    console.log("📊 Current Market State:");
    console.log("   Pool Amount:", ethers.utils.formatUnits(poolAmount, 6), "mUSD");
    console.log("   Long OI (in tokens):", ethers.utils.formatUnits(longOITokens, 18), "mUSDTNGN");
    console.log("   OI Reserve Factor:", ethers.utils.formatUnits(reserveFactor, 30), `(${(parseFloat(ethers.utils.formatUnits(reserveFactor, 30)) * 100).toFixed(0)}%)`);
    console.log();

    // Calculate for same-token market
    const poolPerSide = poolAmount.div(2); // mUSD-mUSD market splits pool
    console.log("💰 Pool Split (mUSD-mUSD market):");
    console.log("   Pool per side:", ethers.utils.formatUnits(poolPerSide, 6), "mUSD");
    console.log();

    // Test with different USDTNGN prices
    const testPrices = [
        { label: "Keeper price", rate: 1455 },
        { label: "Higher rate", rate: 1500 },
        { label: "Lower rate", rate: 1400 },
    ];

    console.log("🔍 Reserve Calculation for LONG positions:");
    console.log("   Formula: reservedUsd = openInterestInTokens × indexTokenPrice");
    console.log();

    for (const test of testPrices) {
        console.log("=".repeat(80));
        console.log(`\n💱 At USDTNGN rate = ${test.rate} (${test.label}):\n`);

        // Index token price in precision 30 (GMX uses this for prices)
        // USDTNGN = 1455 means 1 USDT = 1455 NGN, so 1 USDTNGN token = 1455
        const indexTokenPrice = ethers.utils.parseUnits(test.rate.toString(), 30);

        // Calculate reserved USD for longs
        // reservedUsd = openInterestInTokens * indexTokenPrice.max
        const reservedUsd = longOITokens.mul(indexTokenPrice).div(ethers.BigNumber.from(10).pow(18));

        console.log("   Reserved USD (Long):", ethers.utils.formatUnits(reservedUsd, 30), "USD");

        // Calculate max reserved
        // maxReservedUsd = (poolPerSide in USD) * reserveFactor
        const poolPerSideUsd = poolPerSide.mul(ethers.BigNumber.from(10).pow(24)); // Convert to precision 30
        const maxReservedUsd = poolPerSideUsd.mul(reserveFactor).div(ethers.BigNumber.from(10).pow(30));

        console.log("   Max Reserved USD:", ethers.utils.formatUnits(maxReservedUsd, 30), "USD");
        console.log();

        // Check if it passes validation
        if (reservedUsd.gt(maxReservedUsd)) {
            console.log("   ❌ FAILS: Reserved > Max Reserved");
            console.log("      Excess:", ethers.utils.formatUnits(reservedUsd.sub(maxReservedUsd), 30), "USD");
        } else {
            console.log("   ✅ PASSES: Reserved ≤ Max Reserved");
            const available = maxReservedUsd.sub(reservedUsd);
            console.log("      Available:", ethers.utils.formatUnits(available, 30), "USD");
        }

        // Now test adding the $4937.50 order
        const orderSize = ethers.utils.parseUnits("4937.50", 30);
        const orderSizeInTokens = orderSize.mul(ethers.BigNumber.from(10).pow(18)).div(indexTokenPrice);

        console.log("\n   📝 Adding $4937.50 order:");
        console.log("      Order size in tokens:", ethers.utils.formatUnits(orderSizeInTokens, 18), "mUSDTNGN");

        const newLongOITokens = longOITokens.add(orderSizeInTokens);
        const newReservedUsd = newLongOITokens.mul(indexTokenPrice).div(ethers.BigNumber.from(10).pow(18));

        console.log("      New Long OI (tokens):", ethers.utils.formatUnits(newLongOITokens, 18), "mUSDTNGN");
        console.log("      New Reserved USD:", ethers.utils.formatUnits(newReservedUsd, 30), "USD");
        console.log("      Max Reserved USD:", ethers.utils.formatUnits(maxReservedUsd, 30), "USD");

        if (newReservedUsd.gt(maxReservedUsd)) {
            console.log("\n      ❌ ORDER WOULD FAIL: New Reserved > Max Reserved");
            console.log("         Shortage:", ethers.utils.formatUnits(newReservedUsd.sub(maxReservedUsd), 30), "USD");
        } else {
            console.log("\n      ✅ ORDER WOULD PASS");
            console.log("         Remaining capacity:", ethers.utils.formatUnits(maxReservedUsd.sub(newReservedUsd), 30), "USD");
        }

        console.log();
    }
}

main().catch(console.error);
