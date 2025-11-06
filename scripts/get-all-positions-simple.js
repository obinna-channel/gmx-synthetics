const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";

    // Known accounts that have created orders/positions
    const ACCOUNTS = [
        "0x49e082bdda2865a36ed2294819d3c214709cdbaa", // User from logs
        "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292", // Keeper
        "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44", // From other markets
    ];

    console.log("=== Checking Positions for Known Accounts ===\n");
    console.log("Market:", MARKET, "\n");

    const reader = await ethers.getContractAt("Reader", READER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    let allPositions = [];

    for (const account of ACCOUNTS) {
        console.log(`\n🔍 Checking account: ${account}`);

        // Try both long and short for each account
        for (const isLong of [true, false]) {
            const positionKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["address", "address", "address", "bool"],
                    [account, MARKET, mUSD, isLong]
                )
            );

            try {
                const position = await reader.getPosition(DATA_STORE, positionKey);

                if (position && position.numbers && position.numbers.sizeInUsd && position.numbers.sizeInUsd.gt(0)) {
                    console.log(`  ${isLong ? '🟢 LONG' : '🔴 SHORT'} position found!`);

                    allPositions.push({
                        account,
                        isLong,
                        position,
                        positionKey
                    });
                }
            } catch (e) {
                // Position doesn't exist, that's fine
            }
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`\n📊 Found ${allPositions.length} positions\n`);

    let totalLongSize = ethers.BigNumber.from(0);
    let totalShortSize = ethers.BigNumber.from(0);
    let totalLongSizeInTokens = ethers.BigNumber.from(0);
    let totalShortSizeInTokens = ethers.BigNumber.from(0);

    for (let i = 0; i < allPositions.length; i++) {
        const { account, isLong, position, positionKey } = allPositions[i];

        console.log(`\nPosition ${i + 1}: ${isLong ? '🟢 LONG' : '🔴 SHORT'}`);
        console.log(`  Account: ${account}`);
        console.log(`  Position Key: ${positionKey}`);
        console.log(`  Size (USD): ${ethers.utils.formatUnits(position.numbers.sizeInUsd, 30)}`);
        console.log(`  Size in Tokens: ${ethers.utils.formatUnits(position.numbers.sizeInTokens, 30)}`);
        console.log(`  Size in Tokens (raw): ${position.numbers.sizeInTokens.toString()}`);
        console.log(`  Collateral: ${ethers.utils.formatUnits(position.numbers.collateralAmount, 6)} mUSD`);

        if (isLong) {
            totalLongSize = totalLongSize.add(position.numbers.sizeInUsd);
            totalLongSizeInTokens = totalLongSizeInTokens.add(position.numbers.sizeInTokens);
        } else {
            totalShortSize = totalShortSize.add(position.numbers.sizeInUsd);
            totalShortSizeInTokens = totalShortSizeInTokens.add(position.numbers.sizeInTokens);
        }
    }

    // Compare with DataStore
    console.log("\n" + "=".repeat(80));
    console.log("\n🔍 COMPARISON WITH DATASTORE:\n");

    const OPEN_INTEREST_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])
    );
    const OPEN_INTEREST_IN_TOKENS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])
    );

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

    console.log(`SHORT Positions:`);
    console.log(`  Actual Total Size (USD): ${ethers.utils.formatUnits(totalShortSize, 30)}`);
    console.log(`  DataStore OI (USD): ${ethers.utils.formatUnits(shortOI, 30)}`);
    console.log(`  Match: ${shortOI.eq(totalShortSize) ? '✅' : '❌'}\n`);

    console.log(`  Actual Total Size in Tokens: ${ethers.utils.formatUnits(totalShortSizeInTokens, 30)}`);
    console.log(`  Actual Total Size in Tokens (raw): ${totalShortSizeInTokens.toString()}`);
    console.log(`  DataStore OI in Tokens: ${ethers.utils.formatUnits(shortOIInTokens, 6)} mUSD`);
    console.log(`  DataStore OI in Tokens (raw): ${shortOIInTokens.toString()}`);
    console.log(`  Match: ${shortOIInTokens.eq(totalShortSizeInTokens) ? '✅' : '❌'}`);

    if (!shortOIInTokens.eq(totalShortSizeInTokens)) {
        console.log(`\n  ⚠️  CORRUPTION DETECTED!`);
        const diff = shortOIInTokens.sub(totalShortSizeInTokens);
        console.log(`  Difference (raw): ${diff.toString()}`);
        console.log(`  Difference: ${ethers.utils.formatUnits(diff, 6)} mUSD`);
        console.log(`\n  This corruption is preventing position decreases from working!`);
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

    console.log(`\nLONG Positions:`);
    console.log(`  Actual Total Size (USD): ${ethers.utils.formatUnits(totalLongSize, 30)}`);
    console.log(`  DataStore OI (USD): ${ethers.utils.formatUnits(longOI, 30)}`);
    console.log(`  Match: ${longOI.eq(totalLongSize) ? '✅' : '❌'}\n`);

    console.log(`  Actual Total Size in Tokens: ${ethers.utils.formatUnits(totalLongSizeInTokens, 30)}`);
    console.log(`  DataStore OI in Tokens: ${ethers.utils.formatUnits(longOIInTokens, 6)} mUSD`);
    console.log(`  Match: ${longOIInTokens.eq(totalLongSizeInTokens) ? '✅' : '❌'}`);
}

main().catch(console.error);
