const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";

    console.log("=== All Positions in mUSDTARS Market ===\n");
    console.log("Market:", MARKET);
    console.log("Collateral Token:", mUSD, "\n");

    const reader = await ethers.getContractAt("Reader", READER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    // Get position increase events to find all position keys
    console.log("🔍 Scanning for PositionIncrease events...\n");

    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
    const POSITION_INCREASE_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PositionIncrease"));

    // Scan recent blocks for events (you may need to adjust the range)
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000000); // Last ~1M blocks

    console.log(`Scanning from block ${fromBlock} to ${currentBlock}...`);

    const filter = {
        address: EVENT_EMITTER,
        topics: [
            EVENT_LOG2_SIG,
            POSITION_INCREASE_HASH,
            null, // Any position key
            null  // Any account
        ],
        fromBlock: fromBlock,
        toBlock: currentBlock
    };

    let logs;
    try {
        logs = await ethers.provider.getLogs(filter);
    } catch (e) {
        console.log("⚠️  Error getting logs (range too large), trying smaller range...");
        const smallerFromBlock = Math.max(0, currentBlock - 100000);
        filter.fromBlock = smallerFromBlock;
        logs = await ethers.provider.getLogs(filter);
    }

    console.log(`Found ${logs.length} PositionIncrease events\n`);

    // Extract unique position keys and accounts
    const positionData = new Map();

    for (const log of logs) {
        // Decode the log data to get market address
        const data = log.data;

        // The first address in the data should be the market
        // EventLog2 format: address(0-31), then offsets
        const marketFromEvent = '0x' + data.slice(26, 66);

        if (marketFromEvent.toLowerCase() === MARKET.toLowerCase()) {
            const positionKey = log.topics[2];
            const accountBytes = log.topics[3];
            const account = '0x' + accountBytes.slice(26);

            positionData.set(positionKey, {
                key: positionKey,
                account: account,
                block: log.blockNumber,
                tx: log.transactionHash
            });
        }
    }

    console.log(`📍 Found ${positionData.size} unique positions in this market\n`);
    console.log("=".repeat(80));

    // Now fetch details for each position
    let totalLongSize = ethers.BigNumber.from(0);
    let totalShortSize = ethers.BigNumber.from(0);
    let totalLongCollateral = ethers.BigNumber.from(0);
    let totalShortCollateral = ethers.BigNumber.from(0);
    let activeLongs = 0;
    let activeShorts = 0;

    for (const [key, data] of positionData) {
        try {
            const position = await reader.getPosition(DATA_STORE, key);

            if (position && position.numbers && position.numbers.sizeInUsd && position.numbers.sizeInUsd.gt(0)) {
                const isLong = position.flags.isLong;
                const size = position.numbers.sizeInUsd;
                const sizeInTokens = position.numbers.sizeInTokens;
                const collateral = position.numbers.collateralAmount;

                console.log(`\n${isLong ? '🟢 LONG' : '🔴 SHORT'} Position:`);
                console.log(`  Account: ${data.account}`);
                console.log(`  Position Key: ${key}`);
                console.log(`  Size: ${ethers.utils.formatUnits(size, 30)} USD`);
                console.log(`  Size in Tokens: ${ethers.utils.formatUnits(sizeInTokens, 30)}`);
                console.log(`  Size in Tokens (raw): ${sizeInTokens.toString()}`);
                console.log(`  Collateral: ${ethers.utils.formatUnits(collateral, 6)} mUSD`);
                console.log(`  Borrowing Factor: ${position.numbers.borrowingFactor.toString()}`);
                console.log(`  Opened at Block: ${data.block}`);
                console.log(`  Open TX: https://sepolia.arbiscan.io/tx/${data.tx}`);

                // Calculate leverage
                if (collateral.gt(0)) {
                    const collateralInUsd30 = collateral.mul(ethers.utils.parseUnits("1", 24));
                    const leverage = size.mul(100).div(collateralInUsd30);
                    console.log(`  Leverage: ~${leverage.toNumber() / 100}x`);
                }

                // Accumulate totals
                if (isLong) {
                    totalLongSize = totalLongSize.add(size);
                    totalLongCollateral = totalLongCollateral.add(collateral);
                    activeLongs++;
                } else {
                    totalShortSize = totalShortSize.add(size);
                    totalShortCollateral = totalShortCollateral.add(collateral);
                    activeShorts++;
                }
            }
        } catch (e) {
            console.log(`  ⚠️  Error reading position ${key}:`, e.message);
        }
    }

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("\n📊 SUMMARY:\n");
    console.log(`Active Positions: ${activeLongs + activeShorts}`);
    console.log(`  - Longs: ${activeLongs}`);
    console.log(`  - Shorts: ${activeShorts}\n`);

    console.log(`Total Long Size: ${ethers.utils.formatUnits(totalLongSize, 30)} USD`);
    console.log(`Total Long Collateral: ${ethers.utils.formatUnits(totalLongCollateral, 6)} mUSD\n`);

    console.log(`Total Short Size: ${ethers.utils.formatUnits(totalShortSize, 30)} USD`);
    console.log(`Total Short Collateral: ${ethers.utils.formatUnits(totalShortCollateral, 6)} mUSD\n`);

    // Compare with DataStore values
    console.log("=".repeat(80));
    console.log("\n🔍 DataStore vs Actual Comparison:\n");

    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    const OPEN_INTEREST_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])
    );
    const OPEN_INTEREST_IN_TOKENS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])
    );

    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, mUSD]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);

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

    console.log("Pool Amount:", ethers.utils.formatUnits(poolAmount, 6), "mUSD\n");

    console.log("SHORT Positions:");
    console.log("  DataStore OI (USD):", ethers.utils.formatUnits(shortOI, 30));
    console.log("  Actual Total (USD):", ethers.utils.formatUnits(totalShortSize, 30));
    console.log("  Match:", shortOI.eq(totalShortSize) ? "✅" : "❌");

    console.log("\n  DataStore OI in Tokens:", ethers.utils.formatUnits(shortOIInTokens, 6), "mUSD");
    console.log("  DataStore OI in Tokens (raw):", shortOIInTokens.toString());
    console.log("  Should be ~collateral:", ethers.utils.formatUnits(totalShortCollateral, 6), "mUSD");

    if (shortOIInTokens.gt(ethers.utils.parseUnits("1000000", 6))) {
        console.log("  ⚠️  CORRUPTED! Value way too high!");
    }

    console.log("\nLONG Positions:");
    console.log("  DataStore OI (USD):", ethers.utils.formatUnits(longOI, 30));
    console.log("  Actual Total (USD):", ethers.utils.formatUnits(totalLongSize, 30));
    console.log("  Match:", longOI.eq(totalLongSize) ? "✅" : "❌");

    console.log("\n  DataStore OI in Tokens:", ethers.utils.formatUnits(longOIInTokens, 6), "mUSD");
    console.log("  Should be ~collateral:", ethers.utils.formatUnits(totalLongCollateral, 6), "mUSD");
}

main().catch(console.error);
