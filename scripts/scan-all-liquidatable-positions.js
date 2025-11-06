const { ethers } = require("hardhat");

async function main() {
    const MARKET = ethers.utils.getAddress("0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69"); // mUSDTARS
    const mUSD = ethers.utils.getAddress("0x85bf04B07A6df0172372b959C1C73F3e90F73faf");
    const DATA_STORE = ethers.utils.getAddress("0xD70154A2e4BEF0485Bb6d90265a4F878A4556111");
    const READER = ethers.utils.getAddress("0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8");
    const REFERRAL_STORAGE = ethers.utils.getAddress("0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547");
    const mUSDTARS = ethers.utils.getAddress("0xed6890bE2409F0db06a00C809a298E2E06553BE1");

    console.log("=== Scanning ALL Positions for Liquidation ===\n");
    console.log("Market:", MARKET);
    console.log("Data Store:", DATA_STORE);
    console.log("Reader:", READER, "\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Step 1: Get ALL position keys from DataStore
    console.log("📋 Step 1: Fetching all position keys from DataStore...\n");

    const POSITION_LIST_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    // Get position count
    const positionCount = await dataStore.getBytes32Count(POSITION_LIST_KEY);
    console.log(`   Total positions in POSITION_LIST: ${positionCount.toString()}`);

    if (positionCount.eq(0)) {
        console.log("\n❌ No positions found in DataStore!");
        return;
    }

    // Fetch all position keys (max 1000 at a time to avoid RPC limits)
    const batchSize = 1000;
    const totalToFetch = Math.min(positionCount.toNumber(), batchSize);

    console.log(`   Fetching ${totalToFetch} position keys...\n`);

    const positionKeys = await dataStore.getBytes32ValuesAt(
        POSITION_LIST_KEY,
        0,
        totalToFetch
    );

    console.log(`   ✅ Fetched ${positionKeys.length} position keys\n`);
    console.log("=".repeat(80));

    // Step 2: For each position key, get position details and check if active
    console.log("\n📊 Step 2: Checking which positions are active...\n");

    const activePositions = [];

    for (let i = 0; i < positionKeys.length; i++) {
        const positionKey = positionKeys[i];

        try {
            const position = await reader.getPosition(DATA_STORE, positionKey);

            // Check if position is active (has size)
            if (position.numbers.sizeInUsd.gt(0)) {
                activePositions.push({
                    key: positionKey,
                    position: position,
                    account: position.addresses.account,
                    market: position.addresses.market,
                    collateralToken: position.addresses.collateralToken,
                    isLong: position.flags.isLong
                });

                console.log(`   ✅ Active Position #${activePositions.length}:`);
                console.log(`      Key: ${positionKey}`);
                console.log(`      Account: ${position.addresses.account}`);
                console.log(`      Market: ${position.addresses.market}`);
                console.log(`      Side: ${position.flags.isLong ? 'LONG' : 'SHORT'}`);
                console.log(`      Size: ${ethers.utils.formatUnits(position.numbers.sizeInUsd, 30)} USD`);
                console.log(`      Collateral: ${ethers.utils.formatUnits(position.numbers.collateralAmount, 6)} mUSD`);
                console.log();
            }
        } catch (e) {
            // Position might be deleted or invalid, skip
        }
    }

    console.log("=".repeat(80));
    console.log(`\n📈 Found ${activePositions.length} active positions\n`);

    if (activePositions.length === 0) {
        console.log("❌ No active positions to check for liquidation!");
        return;
    }

    // Step 3: Check liquidation status for each active position
    console.log("=".repeat(80));
    console.log("\n💀 Step 3: Checking liquidation status for active positions...\n");

    // Use correct price precision matching frontend:
    // indexTokenPrice: 12 decimals
    // longTokenPrice: 24 decimals
    // shortTokenPrice: 24 decimals (for single-token markets)
    const currentPrice = ethers.utils.parseUnits("1572.5", 12); // $1572.5 in 12dp
    const stablePrice = ethers.utils.parseUnits("1", 24); // $1 in 24dp

    const marketPrices = {
        indexTokenPrice: { min: currentPrice, max: currentPrice },
        longTokenPrice: { min: stablePrice, max: stablePrice },
        shortTokenPrice: { min: stablePrice, max: stablePrice }
    };

    const marketStruct = {
        marketToken: MARKET,
        indexToken: mUSDTARS,
        longToken: mUSD,
        shortToken: mUSD
    };

    let liquidatableCount = 0;
    const liquidatablePositions = [];

    for (const positionData of activePositions) {
        try {
            console.log(`🔍 Checking position: ${positionData.account} (${positionData.isLong ? 'LONG' : 'SHORT'})`);

            const [isLiquidatable, reason, info] = await reader.isPositionLiquidatable(
                DATA_STORE,
                REFERRAL_STORAGE,
                positionData.key,
                marketStruct,
                marketPrices,
                true,  // shouldValidateMinCollateralUsd
                true   // forLiquidation
            );

            if (isLiquidatable) {
                liquidatableCount++;
                liquidatablePositions.push(positionData);

                console.log(`   ❌ LIQUIDATABLE!`);
                console.log(`      Reason: ${reason}`);
                console.log(`      Remaining Collateral USD: ${ethers.utils.formatUnits(info.remainingCollateralUsd, 30)}`);
                console.log(`      Min Collateral USD: ${ethers.utils.formatUnits(info.minCollateralUsd, 30)}`);
                console.log(`      Min Collateral for Leverage: ${ethers.utils.formatUnits(info.minCollateralUsdForLeverage, 30)}`);
            } else {
                console.log(`   ✅ Not liquidatable`);
                console.log(`      Remaining Collateral USD: ${ethers.utils.formatUnits(info.remainingCollateralUsd, 30)}`);
            }

            console.log();

        } catch (e) {
            console.log(`   ⚠️  Error checking liquidation: ${e.message}\n`);
        }
    }

    // Summary
    console.log("=".repeat(80));
    console.log("\n📊 LIQUIDATION SCAN SUMMARY\n");
    console.log(`Total Positions in DataStore: ${positionCount.toString()}`);
    console.log(`Active Positions (size > 0): ${activePositions.length}`);
    console.log(`Liquidatable Positions: ${liquidatableCount}`);
    console.log(`Healthy Positions: ${activePositions.length - liquidatableCount}`);

    if (liquidatableCount > 0) {
        console.log("\n💀 LIQUIDATABLE POSITIONS:\n");
        for (let i = 0; i < liquidatablePositions.length; i++) {
            const p = liquidatablePositions[i];
            console.log(`${i + 1}. ${p.account} - ${p.isLong ? 'LONG' : 'SHORT'}`);
            console.log(`   Size: ${ethers.utils.formatUnits(p.position.numbers.sizeInUsd, 30)} USD`);
            console.log(`   Collateral: ${ethers.utils.formatUnits(p.position.numbers.collateralAmount, 6)} mUSD`);
            console.log(`   Key: ${p.key}`);
            console.log();
        }
    } else {
        console.log("\n✅ All positions are healthy!");
    }
}

main().catch(console.error);
