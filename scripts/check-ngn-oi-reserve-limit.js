const { ethers } = require("hardhat");

async function main() {
    const NGN_MARKET = "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    console.log("=== NGN Market OI Reserve Validation ===\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get pool amount
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

    // Get OI in tokens
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

    // Get BOTH reserve factors
    const RESERVE_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["RESERVE_FACTOR"])
    );
    const reserveFactorKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [RESERVE_FACTOR, NGN_MARKET, true]
        )
    );
    const reserveFactor = await dataStore.getUint(reserveFactorKey);

    const OPEN_INTEREST_RESERVE_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_RESERVE_FACTOR"])
    );
    const oiReserveFactorKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [OPEN_INTEREST_RESERVE_FACTOR, NGN_MARKET, true]
        )
    );
    const oiReserveFactor = await dataStore.getUint(oiReserveFactorKey);

    console.log("📊 Current State:");
    console.log("   Pool Amount:", ethers.utils.formatUnits(poolAmount, 6), "mUSD");
    console.log("   Long OI (tokens):", ethers.utils.formatUnits(longOITokens, 18), "mUSDTNGN");
    console.log();
    console.log("   Reserve Factor:", ethers.utils.formatUnits(reserveFactor, 30), `(${(parseFloat(ethers.utils.formatUnits(reserveFactor, 30)) * 100).toFixed(0)}%)`);
    console.log("   OI Reserve Factor:", ethers.utils.formatUnits(oiReserveFactor, 30), `(${(parseFloat(ethers.utils.formatUnits(oiReserveFactor, 30)) * 100).toFixed(0)}%)`);
    console.log();

    // For mUSD-mUSD market, pool is split
    const poolPerSide = poolAmount.div(2);
    const poolPerSideUsd = poolPerSide.mul(ethers.BigNumber.from(10).pow(24)); // to precision 30

    console.log("💰 Pool (split for mUSD-mUSD):");
    console.log("   Pool per side:", ethers.utils.formatUnits(poolPerSide, 6), "mUSD");
    console.log("   Pool per side (USD):", ethers.utils.formatUnits(poolPerSideUsd, 30), "USD");
    console.log();

    // Test with keeper's USDTNGN price
    const tslaRate = 1455;
    const indexTokenPrice = ethers.utils.parseUnits(tslaRate.toString(), 30);

    console.log("💱 Using USDTNGN rate:", tslaRate);
    console.log();

    // Calculate reserved USD for longs
    // reservedUsd = openInterestInTokens * indexTokenPrice.max
    const reservedUsd = longOITokens.mul(indexTokenPrice).div(ethers.BigNumber.from(10).pow(18));

    console.log("📈 Current Reserved USD:");
    console.log("   Formula: OI_tokens × price");
    console.log("   Reserved:", ethers.utils.formatUnits(reservedUsd, 30), "USD");
    console.log();

    // Calculate max reserved for BOTH factors
    const maxReserved_Reserve = poolPerSideUsd.mul(reserveFactor).div(ethers.BigNumber.from(10).pow(30));
    const maxReserved_OIReserve = poolPerSideUsd.mul(oiReserveFactor).div(ethers.BigNumber.from(10).pow(30));

    console.log("=".repeat(80));
    console.log("\n🔍 Validation 1: validateReserve() with reserveFactor = 500%\n");
    console.log("   Max Reserved:", ethers.utils.formatUnits(maxReserved_Reserve, 30), "USD");
    console.log("   Current Reserved:", ethers.utils.formatUnits(reservedUsd, 30), "USD");

    if (reservedUsd.gt(maxReserved_Reserve)) {
        console.log("   ❌ FAILS");
    } else {
        console.log("   ✅ PASSES");
        console.log("   Available:", ethers.utils.formatUnits(maxReserved_Reserve.sub(reservedUsd), 30), "USD");
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n🔍 Validation 2: validateOpenInterestReserve() with oiReserveFactor = 700%\n");
    console.log("   Max Reserved:", ethers.utils.formatUnits(maxReserved_OIReserve, 30), "USD");
    console.log("   Current Reserved:", ethers.utils.formatUnits(reservedUsd, 30), "USD");

    if (reservedUsd.gt(maxReserved_OIReserve)) {
        console.log("   ❌ FAILS - This is the limiting factor!");
    } else {
        console.log("   ✅ PASSES");
        console.log("   Available:", ethers.utils.formatUnits(maxReserved_OIReserve.sub(reservedUsd), 30), "USD");
    }

    // Test adding the $4937.50 order
    const orderSize = ethers.utils.parseUnits("4937.50", 30);
    const orderSizeInTokens = orderSize.mul(ethers.BigNumber.from(10).pow(18)).div(indexTokenPrice);

    console.log("\n" + "=".repeat(80));
    console.log("\n💼 Adding $4,937.50 Order:\n");
    console.log("   Order size in tokens:", ethers.utils.formatUnits(orderSizeInTokens, 18), "mUSDTNGN");

    const newLongOITokens = longOITokens.add(orderSizeInTokens);
    const newReservedUsd = newLongOITokens.mul(indexTokenPrice).div(ethers.BigNumber.from(10).pow(18));

    console.log("   New OI (tokens):", ethers.utils.formatUnits(newLongOITokens, 18), "mUSDTNGN");
    console.log("   New Reserved USD:", ethers.utils.formatUnits(newReservedUsd, 30), "USD");
    console.log();

    console.log("   Validation 1 (reserveFactor = 500%):");
    console.log("      Max Reserved:", ethers.utils.formatUnits(maxReserved_Reserve, 30), "USD");
    if (newReservedUsd.gt(maxReserved_Reserve)) {
        console.log("      ❌ WOULD FAIL");
        console.log("      Shortage:", ethers.utils.formatUnits(newReservedUsd.sub(maxReserved_Reserve), 30), "USD");
    } else {
        console.log("      ✅ WOULD PASS");
    }

    console.log();
    console.log("   Validation 2 (oiReserveFactor = 700%):");
    console.log("      Max Reserved:", ethers.utils.formatUnits(maxReserved_OIReserve, 30), "USD");
    if (newReservedUsd.gt(maxReserved_OIReserve)) {
        console.log("      ❌ WOULD FAIL - ORDER REJECTED!");
        console.log("      Shortage:", ethers.utils.formatUnits(newReservedUsd.sub(maxReserved_OIReserve), 30), "USD");
    } else {
        console.log("      ✅ WOULD PASS");
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n💡 Maximum Order Size at Current State:\n");

    const availableCapacity = maxReserved_OIReserve.sub(reservedUsd);
    const maxOrderSizeUsd = availableCapacity.mul(ethers.BigNumber.from(10).pow(18)).div(indexTokenPrice);
    const maxOrderDollars = parseFloat(ethers.utils.formatUnits(maxOrderSizeUsd, 18)) * tslaRate;

    console.log("   Available capacity:", ethers.utils.formatUnits(availableCapacity, 30), "USD");
    console.log("   Max order size:", maxOrderDollars.toFixed(2), "USD");
    console.log();
    console.log("   Your order ($4,937.50) exceeds max by: $" + (4937.50 - maxOrderDollars).toFixed(2));
}

main().catch(console.error);
