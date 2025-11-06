const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";

    console.log("=== Finding ALL Accounts with Positions ===\n");

    const currentBlock = await ethers.provider.getBlockNumber();
    console.log("Current block:", currentBlock);

    // Scan for OrderCreated events to find all accounts
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
    const ORDER_CREATED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCreated"));

    const accounts = new Set();

    // Try multiple block ranges to maximize coverage
    const ranges = [
        [currentBlock - 500000, currentBlock],
        [currentBlock - 1000000, currentBlock - 500000],
        [currentBlock - 2000000, currentBlock - 1000000],
    ];

    for (const [fromBlock, toBlock] of ranges) {
        if (fromBlock < 0) continue;

        console.log(`\n🔍 Scanning blocks ${fromBlock} to ${toBlock}...`);

        try {
            const filter = {
                address: EVENT_EMITTER,
                topics: [EVENT_LOG2_SIG, ORDER_CREATED_HASH],
                fromBlock: fromBlock,
                toBlock: toBlock
            };

            const logs = await ethers.provider.getLogs(filter);
            console.log(`   Found ${logs.length} OrderCreated events`);

            for (const log of logs) {
                const accountBytes = log.topics[3];
                const account = '0x' + accountBytes.slice(26);
                accounts.add(account.toLowerCase());
            }
        } catch (e) {
            console.log(`   ⚠️  Error scanning range:`, e.message.slice(0, 100));
        }
    }

    console.log(`\n📊 Found ${accounts.size} unique accounts\n`);
    console.log("Accounts:", Array.from(accounts));

    // Now check positions for all these accounts
    console.log("\n" + "=".repeat(80));
    console.log("\n🔍 Checking positions for all accounts...\n");

    const reader = await ethers.getContractAt("Reader", READER);
    const allPositions = [];

    for (const account of accounts) {
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
                    allPositions.push({
                        account,
                        isLong,
                        position,
                        positionKey
                    });
                    console.log(`  ✅ ${isLong ? 'LONG' : 'SHORT'} position: ${account}`);
                }
            } catch (e) {
                // No position
            }
        }
    }

    console.log(`\n📍 Total active positions found: ${allPositions.length}\n`);
    console.log("=".repeat(80));

    // Calculate totals
    let totalLongSize = ethers.BigNumber.from(0);
    let totalShortSize = ethers.BigNumber.from(0);
    let totalLongSizeInTokens = ethers.BigNumber.from(0);
    let totalShortSizeInTokens = ethers.BigNumber.from(0);

    for (const { account, isLong, position } of allPositions) {
        console.log(`\n${isLong ? '🟢 LONG' : '🔴 SHORT'} - ${account}`);
        console.log(`  Size (USD): ${ethers.utils.formatUnits(position.numbers.sizeInUsd, 30)}`);
        console.log(`  Size in Tokens (30dp): ${position.numbers.sizeInTokens.toString()}`);
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
    console.log("\n📊 TOTALS vs DATASTORE:\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    const OPEN_INTEREST_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])
    );
    const OPEN_INTEREST_IN_TOKENS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])
    );

    // SHORT
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

    console.log(`SHORT:`);
    console.log(`  Sum of all positions (USD): ${ethers.utils.formatUnits(totalShortSize, 30)}`);
    console.log(`  DataStore OI (USD): ${ethers.utils.formatUnits(shortOI, 30)}`);
    console.log(`  Match: ${shortOI.eq(totalShortSize) ? '✅' : '❌ MISMATCH'}`);
    console.log();
    console.log(`  Sum of all positions (tokens, 30dp): ${totalShortSizeInTokens.toString()}`);
    console.log(`  DataStore OI in Tokens (30dp): ${shortOIInTokens.toString()}`);
    console.log(`  Match: ${shortOIInTokens.eq(totalShortSizeInTokens) ? '✅' : '❌ MISMATCH'}`);

    if (!shortOIInTokens.eq(totalShortSizeInTokens)) {
        const diff = shortOIInTokens.sub(totalShortSizeInTokens);
        console.log(`  ⚠️  Difference: ${diff.toString()} (30dp)`);
        console.log(`  This suggests ${diff.gt(0) ? 'ghost positions or unclosed' : 'negative'} OI`);
    }

    // LONG
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

    console.log(`\nLONG:`);
    console.log(`  Sum of all positions (USD): ${ethers.utils.formatUnits(totalLongSize, 30)}`);
    console.log(`  DataStore OI (USD): ${ethers.utils.formatUnits(longOI, 30)}`);
    console.log(`  Match: ${longOI.eq(totalLongSize) ? '✅' : '❌ MISMATCH'}`);
    console.log();
    console.log(`  Sum of all positions (tokens, 30dp): ${totalLongSizeInTokens.toString()}`);
    console.log(`  DataStore OI in Tokens (30dp): ${longOIInTokens.toString()}`);
    console.log(`  Match: ${longOIInTokens.eq(totalLongSizeInTokens) ? '✅' : '❌ MISMATCH'}`);
}

main().catch(console.error);
