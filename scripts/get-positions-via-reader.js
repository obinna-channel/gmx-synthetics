const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const REFERRAL_STORAGE = "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547";

    console.log("=== Getting All Positions via Reader ===\n");
    console.log("Market:", MARKET);
    console.log("Using Reader:", READER, "\n");

    const reader = await ethers.getContractAt("Reader", READER);

    // Try to get positions using getAccountPositionInfoList
    // This function takes:
    // - dataStore
    // - referralStorage
    // - positionKeys (empty array to get all)
    // - markets (filter by market)
    // - accounts (empty array to get all)
    // - flags (order types filter)
    // - start index
    // - end index

    console.log("🔍 Fetching positions from Reader...\n");

    try {
        const positionInfoList = await reader.getAccountPositionInfoList(
            DATA_STORE,
            REFERRAL_STORAGE,
            [], // positionKeys - empty to get all
            [MARKET], // markets - filter by this market only
            [], // accounts - empty to get all accounts
            [], // flags
            0, // start
            100 // max 100 positions
        );

        console.log(`Found ${positionInfoList.length} positions\n`);
        console.log("=".repeat(80));

        let totalLongSize = ethers.BigNumber.from(0);
        let totalShortSize = ethers.BigNumber.from(0);
        let totalLongCollateral = ethers.BigNumber.from(0);
        let totalShortCollateral = ethers.BigNumber.from(0);
        let activeLongs = 0;
        let activeShorts = 0;
        let totalLongSizeInTokens = ethers.BigNumber.from(0);
        let totalShortSizeInTokens = ethers.BigNumber.from(0);

        for (let i = 0; i < positionInfoList.length; i++) {
            const posInfo = positionInfoList[i];
            const position = posInfo.position;

            if (position.numbers.sizeInUsd.gt(0)) {
                const isLong = position.flags.isLong;
                const account = position.addresses.account;
                const size = position.numbers.sizeInUsd;
                const sizeInTokens = position.numbers.sizeInTokens;
                const collateral = position.numbers.collateralAmount;

                console.log(`\n${isLong ? '🟢 LONG' : '🔴 SHORT'} Position #${i + 1}:`);
                console.log(`  Account: ${account}`);
                console.log(`  Market: ${position.addresses.market}`);
                console.log(`  Collateral Token: ${position.addresses.collateralToken}`);
                console.log(`  Position Key: ${position.key}`);
                console.log(`  Size (USD): ${ethers.utils.formatUnits(size, 30)}`);
                console.log(`  Size in Tokens: ${ethers.utils.formatUnits(sizeInTokens, 30)}`);
                console.log(`  Size in Tokens (raw): ${sizeInTokens.toString()}`);
                console.log(`  Collateral: ${ethers.utils.formatUnits(collateral, 6)} mUSD`);
                console.log(`  Borrowing Factor: ${position.numbers.borrowingFactor.toString()}`);
                console.log(`  Funding Fee Per Size: ${position.numbers.fundingFeeAmountPerSize.toString()}`);

                // Calculate leverage
                if (collateral.gt(0)) {
                    const collateralInUsd30 = collateral.mul(ethers.utils.parseUnits("1", 24));
                    const leverage = size.mul(100).div(collateralInUsd30);
                    console.log(`  Leverage: ~${leverage.toNumber() / 100}x`);
                }

                // Check if sizeInTokens looks corrupted
                const expectedSizeInTokens = size.div(ethers.utils.parseUnits("1", 24)); // Rough estimate
                if (sizeInTokens.lt(expectedSizeInTokens.div(1000)) || sizeInTokens.gt(expectedSizeInTokens.mul(1000))) {
                    console.log(`  ⚠️  SIZE IN TOKENS LOOKS WRONG!`);
                    console.log(`     Expected ~${ethers.utils.formatUnits(expectedSizeInTokens, 6)} mUSD`);
                    console.log(`     Got: ${ethers.utils.formatUnits(sizeInTokens, 30)}`);
                }

                // Accumulate totals
                if (isLong) {
                    totalLongSize = totalLongSize.add(size);
                    totalLongCollateral = totalLongCollateral.add(collateral);
                    totalLongSizeInTokens = totalLongSizeInTokens.add(sizeInTokens);
                    activeLongs++;
                } else {
                    totalShortSize = totalShortSize.add(size);
                    totalShortCollateral = totalShortCollateral.add(collateral);
                    totalShortSizeInTokens = totalShortSizeInTokens.add(sizeInTokens);
                    activeShorts++;
                }
            }
        }

        // Summary
        console.log("\n" + "=".repeat(80));
        console.log("\n📊 POSITIONS SUMMARY:\n");
        console.log(`Active Positions: ${activeLongs + activeShorts}`);
        console.log(`  - Longs: ${activeLongs}`);
        console.log(`  - Shorts: ${activeShorts}\n`);

        console.log(`LONG Positions:`);
        console.log(`  Total Size (USD): ${ethers.utils.formatUnits(totalLongSize, 30)}`);
        console.log(`  Total Size in Tokens: ${ethers.utils.formatUnits(totalLongSizeInTokens, 30)}`);
        console.log(`  Total Collateral: ${ethers.utils.formatUnits(totalLongCollateral, 6)} mUSD\n`);

        console.log(`SHORT Positions:`);
        console.log(`  Total Size (USD): ${ethers.utils.formatUnits(totalShortSize, 30)}`);
        console.log(`  Total Size in Tokens: ${ethers.utils.formatUnits(totalShortSizeInTokens, 30)}`);
        console.log(`  Total Size in Tokens (raw): ${totalShortSizeInTokens.toString()}`);
        console.log(`  Total Collateral: ${ethers.utils.formatUnits(totalShortCollateral, 6)} mUSD\n`);

        // Compare with DataStore
        console.log("=".repeat(80));
        console.log("\n🔍 DATASTORE COMPARISON:\n");

        const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

        const POOL_AMOUNT_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
        );
        const OPEN_INTEREST_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])
        );
        const OPEN_INTEREST_IN_TOKENS_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])
        );

        // Pool amount
        const poolAmountKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [POOL_AMOUNT_KEY, MARKET, mUSD]
            )
        );
        const poolAmount = await dataStore.getUint(poolAmountKey);
        console.log(`Pool Amount: ${ethers.utils.formatUnits(poolAmount, 6)} mUSD\n`);

        // Short OI
        const shortOIKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [OPEN_INTEREST_KEY, MARKET, mUSD, false]
            )
        );
        const shortOI = await dataStore.getUint(shortOIKey);

        const shortOIInTokensKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [OPEN_INTEREST_IN_TOKENS_KEY, MARKET, mUSD, false]
            )
        );
        const shortOIInTokens = await dataStore.getUint(shortOIInTokensKey);

        console.log(`SHORT Open Interest:`);
        console.log(`  DataStore OI (USD): ${ethers.utils.formatUnits(shortOI, 30)}`);
        console.log(`  Actual Sum (USD): ${ethers.utils.formatUnits(totalShortSize, 30)}`);
        console.log(`  Match: ${shortOI.eq(totalShortSize) ? '✅' : '❌'}\n`);

        console.log(`  DataStore OI in Tokens: ${ethers.utils.formatUnits(shortOIInTokens, 6)} mUSD`);
        console.log(`  DataStore OI in Tokens (raw): ${shortOIInTokens.toString()}`);
        console.log(`  Actual Sum in Tokens: ${ethers.utils.formatUnits(totalShortSizeInTokens, 30)}`);
        console.log(`  Actual Sum in Tokens (raw): ${totalShortSizeInTokens.toString()}`);
        console.log(`  Match: ${shortOIInTokens.eq(totalShortSizeInTokens) ? '✅' : '❌'}`);

        if (!shortOIInTokens.eq(totalShortSizeInTokens)) {
            console.log(`  ⚠️  MISMATCH! DataStore is corrupted!`);
            console.log(`  Difference: ${shortOIInTokens.sub(totalShortSizeInTokens).toString()}`);
        }

        // Long OI
        const longOIKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [OPEN_INTEREST_KEY, MARKET, mUSD, true]
            )
        );
        const longOI = await dataStore.getUint(longOIKey);

        const longOIInTokensKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [OPEN_INTEREST_IN_TOKENS_KEY, MARKET, mUSD, true]
            )
        );
        const longOIInTokens = await dataStore.getUint(longOIInTokensKey);

        console.log(`\nLONG Open Interest:`);
        console.log(`  DataStore OI (USD): ${ethers.utils.formatUnits(longOI, 30)}`);
        console.log(`  Actual Sum (USD): ${ethers.utils.formatUnits(totalLongSize, 30)}`);
        console.log(`  Match: ${longOI.eq(totalLongSize) ? '✅' : '❌'}\n`);

        console.log(`  DataStore OI in Tokens: ${ethers.utils.formatUnits(longOIInTokens, 6)} mUSD`);
        console.log(`  Actual Sum in Tokens: ${ethers.utils.formatUnits(totalLongSizeInTokens, 30)}`);
        console.log(`  Match: ${longOIInTokens.eq(totalLongSizeInTokens) ? '✅' : '❌'}`);

    } catch (error) {
        console.log("❌ Error calling Reader:", error.message);
        console.log(error);
    }
}

main().catch(console.error);
