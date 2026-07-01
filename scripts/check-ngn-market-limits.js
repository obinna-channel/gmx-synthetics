const { ethers } = require("hardhat");

async function main() {
    const NGN_MARKET = "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb";
    const mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";

    console.log("=== NGN Market Limits & Current State ===\n");
    console.log("Market:", NGN_MARKET);
    console.log();

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Market info
    const marketInfo = await reader.getMarket(DATA_STORE, NGN_MARKET);

    console.log("📊 Market Configuration:");
    console.log("   Index Token (mUSDTNGN):", marketInfo.indexToken);
    console.log("   Long Token (mUSD):", marketInfo.longToken);
    console.log("   Short Token (mUSD):", marketInfo.shortToken);
    console.log();

    // Get pool amounts
    const longTokenPoolAmount = await dataStore.getUint(
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [ethers.utils.id("POOL_AMOUNT"), NGN_MARKET, mUSD]
            )
        )
    );

    console.log("💰 Pool State:");
    console.log("   mUSD Pool Amount:", ethers.utils.formatUnits(longTokenPoolAmount, 6), "mUSD");
    console.log();

    // Get open interest for both sides
    const longOpenInterest = await dataStore.getUint(
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [ethers.utils.id("OPEN_INTEREST"), NGN_MARKET, mUSD, true]
            )
        )
    );

    const shortOpenInterest = await dataStore.getUint(
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [ethers.utils.id("OPEN_INTEREST"), NGN_MARKET, mUSD, false]
            )
        )
    );

    console.log("📈 Open Interest:");
    console.log("   LONG:", ethers.utils.formatUnits(longOpenInterest, 30), "USD");
    console.log("   SHORT:", ethers.utils.formatUnits(shortOpenInterest, 30), "USD");
    console.log();

    // Get max open interest
    const maxLongOpenInterest = await dataStore.getUint(
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bool"],
                [ethers.utils.id("MAX_OPEN_INTEREST"), NGN_MARKET, true]
            )
        )
    );

    const maxShortOpenInterest = await dataStore.getUint(
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "bool"],
                [ethers.utils.id("MAX_OPEN_INTEREST"), NGN_MARKET, false]
            )
        )
    );

    console.log("🔒 Max Open Interest Limits:");
    console.log("   Max LONG OI:", ethers.utils.formatUnits(maxLongOpenInterest, 30), "USD");
    console.log("   Max SHORT OI:", ethers.utils.formatUnits(maxShortOpenInterest, 30), "USD");
    console.log();

    // Calculate available capacity
    const availableLongOI = maxLongOpenInterest.sub(longOpenInterest);
    const availableShortOI = maxShortOpenInterest.sub(shortOpenInterest);

    console.log("✅ Available Capacity:");
    console.log("   LONG:", ethers.utils.formatUnits(availableLongOI, 30), "USD");
    console.log("   SHORT:", ethers.utils.formatUnits(availableShortOI, 30), "USD");
    console.log();

    // Get reserve factor
    const reserveFactor = await dataStore.getUint(
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ethers.utils.id("RESERVE_FACTOR"), NGN_MARKET]
            )
        )
    );

    const openInterestReserveFactor = await dataStore.getUint(
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ethers.utils.id("OPEN_INTEREST_RESERVE_FACTOR"), NGN_MARKET]
            )
        )
    );

    console.log("🏦 Reserve Factors:");
    console.log("   Reserve Factor:", ethers.utils.formatUnits(reserveFactor, 30));
    console.log("   OI Reserve Factor:", ethers.utils.formatUnits(openInterestReserveFactor, 30));
    console.log();

    // Calculate reserved amounts
    const totalOI = longOpenInterest.add(shortOpenInterest);
    const reservedUsd = totalOI.mul(openInterestReserveFactor).div(ethers.utils.parseUnits("1", 30));

    console.log("💼 Reserved Amounts:");
    console.log("   Total Open Interest:", ethers.utils.formatUnits(totalOI, 30), "USD");
    console.log("   Reserved USD:", ethers.utils.formatUnits(reservedUsd, 30), "USD");
    console.log();

    // Get max pool USD for deposit
    const maxPoolUsd = await dataStore.getUint(
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ethers.utils.id("MAX_POOL_USD_FOR_DEPOSIT"), NGN_MARKET]
            )
        )
    );

    console.log("💵 Pool Limits:");
    console.log("   Max Pool USD for Deposit:", ethers.utils.formatUnits(maxPoolUsd, 30), "USD");
    console.log();

    // Simulate the failed order
    const failedOrderSize = ethers.utils.parseUnits("4937.50", 30);

    console.log("=".repeat(80));
    console.log("\n🔍 Analyzing Failed Order:\n");
    console.log("Order Size:", ethers.utils.formatUnits(failedOrderSize, 30), "USD");
    console.log();

    const newLongOI = longOpenInterest.add(failedOrderSize);

    console.log("If order executes:");
    console.log("   New LONG OI:", ethers.utils.formatUnits(newLongOI, 30), "USD");
    console.log("   Max LONG OI:", ethers.utils.formatUnits(maxLongOpenInterest, 30), "USD");
    console.log();

    if (newLongOI.gt(maxLongOpenInterest)) {
        console.log("❌ ORDER WOULD EXCEED MAX LONG OPEN INTEREST!");
        console.log("   Excess:", ethers.utils.formatUnits(newLongOI.sub(maxLongOpenInterest), 30), "USD");
    } else {
        console.log("✅ Order within max OI limits");
    }
    console.log();

    // Check reserve capacity
    const newTotalOI = newLongOI.add(shortOpenInterest);
    const newReservedUsd = newTotalOI.mul(openInterestReserveFactor).div(ethers.utils.parseUnits("1", 30));
    const poolValueUsd = longTokenPoolAmount; // Assuming 1:1 for mUSD

    console.log("Reserve Check:");
    console.log("   New Total OI:", ethers.utils.formatUnits(newTotalOI, 30), "USD");
    console.log("   New Reserved USD:", ethers.utils.formatUnits(newReservedUsd, 30), "USD");
    console.log("   Pool Value:", ethers.utils.formatUnits(poolValueUsd, 6), "USD");

    if (newReservedUsd.gt(poolValueUsd)) {
        console.log("❌ ORDER WOULD EXCEED POOL RESERVES!");
        console.log("   Reserve shortage:", ethers.utils.formatUnits(newReservedUsd.sub(poolValueUsd), 6), "USD");
    } else {
        console.log("✅ Order within reserve limits");
    }
}

main().catch(console.error);
