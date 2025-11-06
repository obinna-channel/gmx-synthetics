const { ethers } = require("hardhat");

/**
 * Verify Execution Price Calculation
 *
 * This script:
 * 1. Queries the Reader/DataStore for position data (sizeInUsd, sizeInTokens, pendingImpactAmount)
 * 2. Calculates execution price using: executionPrice = sizeInUsd / (sizeInTokens + pendingImpactAmount)
 * 3. Queries the PositionIncrease event for the same position
 * 4. Compares the calculated price vs the event's executionPrice
 */

async function main() {
    const ACCOUNT_ADDRESS = process.env.ACCOUNT || "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const MARKET_ADDRESS = process.env.MARKET || "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb"; // mUSDTNGN [mUSD-mUSD]
    const COLLATERAL_TOKEN = process.env.COLLATERAL || "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"; // mUSD
    const IS_LONG = process.env.IS_LONG === "false" ? false : true;
    const LOOKBACK_BLOCKS = 400000;

    const ADDRESSES = {
        EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C",
    };

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         VERIFY EXECUTION PRICE CALCULATION                       ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    console.log(`🔍 Position Details:`);
    console.log(`   Account: ${ACCOUNT_ADDRESS}`);
    console.log(`   Market: ${MARKET_ADDRESS}`);
    console.log(`   Collateral: ${COLLATERAL_TOKEN}`);
    console.log(`   Side: ${IS_LONG ? 'LONG' : 'SHORT'}\n`);

    // Get contracts
    const dataStore = await ethers.getContract("DataStore");
    const reader = await ethers.getContract("Reader");
    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);

    // Calculate position key
    // positionKey = keccak256(abi.encode(account, market, collateralToken, isLong))
    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [ACCOUNT_ADDRESS, MARKET_ADDRESS, COLLATERAL_TOKEN, IS_LONG]
        )
    );

    console.log(`📝 Position Key: ${positionKey}\n`);

    console.log(`═`.repeat(80));
    console.log(`\n1️⃣  QUERY READER FOR POSITION DATA\n`);

    // Get position from Reader
    const position = await reader.getPosition(dataStore.address, positionKey);

    if (position.numbers.sizeInUsd.eq(0)) {
        console.log(`❌ No position found with this key`);
        return;
    }

    const sizeInUsd = position.numbers.sizeInUsd;
    const sizeInTokens = position.numbers.sizeInTokens;
    const pendingImpactAmount = position.numbers.pendingImpactAmount;
    const collateralAmount = position.numbers.collateralAmount;
    const isLong = position.flags.isLong;

    console.log(`📊 Position Data from Reader/DataStore:`);
    console.log(`   sizeInUsd (30 decimals):        ${sizeInUsd.toString()}`);
    console.log(`   sizeInTokens (18 decimals):     ${sizeInTokens.toString()}`);
    console.log(`   pendingImpactAmount (18 decimals): ${pendingImpactAmount.toString()}`);
    console.log(`   collateralAmount (6 decimals):  ${collateralAmount.toString()}`);
    console.log(`   isLong:                         ${isLong}`);
    console.log(`\n`);

    console.log(`📐 Formatted Values:`);
    console.log(`   sizeInUsd:           ${ethers.utils.formatUnits(sizeInUsd, 30)} USD`);
    console.log(`   sizeInTokens:        ${ethers.utils.formatUnits(sizeInTokens, 18)} tokens`);
    console.log(`   pendingImpactAmount: ${ethers.utils.formatUnits(pendingImpactAmount, 18)} tokens`);
    console.log(`\n`);

    console.log(`═`.repeat(80));
    console.log(`\n2️⃣  CALCULATE EXECUTION PRICE FROM STORED DATA\n`);

    // For LONG: actualSizeDeltaInTokens = sizeInTokens + pendingImpactAmount
    // For SHORT: actualSizeDeltaInTokens = sizeInTokens - pendingImpactAmount
    let actualSizeDeltaInTokens;
    if (isLong) {
        actualSizeDeltaInTokens = sizeInTokens.add(pendingImpactAmount);
        console.log(`📝 Formula for LONG: actualSizeDeltaInTokens = sizeInTokens + pendingImpactAmount`);
    } else {
        actualSizeDeltaInTokens = sizeInTokens.sub(pendingImpactAmount);
        console.log(`📝 Formula for SHORT: actualSizeDeltaInTokens = sizeInTokens - pendingImpactAmount`);
    }

    console.log(`   actualSizeDeltaInTokens: ${actualSizeDeltaInTokens.toString()} (18 decimals)`);
    console.log(`   actualSizeDeltaInTokens: ${ethers.utils.formatUnits(actualSizeDeltaInTokens, 18)} tokens`);
    console.log(`\n`);

    // executionPrice = sizeInUsd / actualSizeDeltaInTokens
    // sizeInUsd: 30 decimals, actualSizeDeltaInTokens: 18 decimals
    // Result: 30 - 18 = 12 decimals
    // Do the division directly since 30 - 18 = 12
    const calculatedExecutionPrice = sizeInUsd.div(actualSizeDeltaInTokens);

    console.log(`📝 Formula: executionPrice = sizeInUsd / actualSizeDeltaInTokens`);
    console.log(`   Calculated executionPrice (12 decimals): ${calculatedExecutionPrice.toString()}`);
    console.log(`   Calculated executionPrice (formatted):   ${ethers.utils.formatUnits(calculatedExecutionPrice, 12)}`);
    console.log(`\n`);

    console.log(`═`.repeat(80));
    console.log(`\n3️⃣  QUERY POSITION INCREASE EVENT\n`);

    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - LOOKBACK_BLOCKS;

    console.log(`🔎 Searching for PositionIncrease events...`);
    console.log(`   From block: ${fromBlock}`);
    console.log(`   To block: ${currentBlock}\n`);

    const eventLog1Topic0 = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';
    const positionIncreaseHash = ethers.utils.id("PositionIncrease");
    const accountBytes32 = ethers.utils.hexZeroPad(ACCOUNT_ADDRESS, 32);

    const filter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            eventLog1Topic0,
            positionIncreaseHash,
            accountBytes32
        ]
    };

    const logs = await ethers.provider.getLogs(filter);
    console.log(`   Found ${logs.length} PositionIncrease events for this account\n`);

    // Helper function to get value from items by key
    function getValueFromItems(items, key) {
        if (!items || !items.items) return null;
        for (const item of items.items) {
            if (item.key === key) {
                return item.value;
            }
        }
        return null;
    }

    // Find the event for this specific position (matching market)
    let matchingEvent = null;
    for (const log of logs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventData = parsed.args[4];

            const market = getValueFromItems(eventData.addressItems, 'market');
            const eventSizeInUsd = getValueFromItems(eventData.uintItems, 'sizeInUsd');

            // Match by market and sizeInUsd (to find the latest/matching increase)
            if (market.toLowerCase() === MARKET_ADDRESS.toLowerCase() &&
                eventSizeInUsd.eq(sizeInUsd)) {
                matchingEvent = {
                    blockNumber: log.blockNumber,
                    transactionHash: log.transactionHash,
                    executionPrice: getValueFromItems(eventData.uintItems, 'executionPrice'),
                    sizeInUsd: eventSizeInUsd,
                    sizeInTokens: getValueFromItems(eventData.uintItems, 'sizeInTokens'),
                    sizeDeltaUsd: getValueFromItems(eventData.uintItems, 'sizeDeltaUsd'),
                    sizeDeltaInTokens: getValueFromItems(eventData.uintItems, 'sizeDeltaInTokens'),
                    pendingPriceImpactUsd: getValueFromItems(eventData.intItems, 'pendingPriceImpactUsd'),
                    pendingPriceImpactAmount: getValueFromItems(eventData.intItems, 'pendingPriceImpactAmount'),
                };
                break;
            }
        } catch (error) {
            // Skip unparseable events
        }
    }

    if (!matchingEvent) {
        console.log(`❌ Could not find matching PositionIncrease event`);
        console.log(`   This might be expected if the position was opened more than ${LOOKBACK_BLOCKS} blocks ago\n`);
    } else {
        console.log(`✅ Found matching PositionIncrease event:`);
        console.log(`   Block: ${matchingEvent.blockNumber}`);
        console.log(`   Transaction: ${matchingEvent.transactionHash}\n`);

        console.log(`📊 Event Data:`);
        console.log(`   executionPrice (12 decimals):   ${matchingEvent.executionPrice.toString()}`);
        console.log(`   executionPrice (formatted):     ${ethers.utils.formatUnits(matchingEvent.executionPrice, 12)}`);
        console.log(`   sizeInUsd (30 decimals):        ${matchingEvent.sizeInUsd.toString()}`);
        console.log(`   sizeInTokens (18 decimals):     ${matchingEvent.sizeInTokens.toString()}`);
        console.log(`   sizeDeltaUsd (30 decimals):     ${matchingEvent.sizeDeltaUsd.toString()}`);
        console.log(`   sizeDeltaInTokens (18 decimals): ${matchingEvent.sizeDeltaInTokens.toString()}`);
        console.log(`   pendingPriceImpactAmount (18 decimals): ${matchingEvent.pendingPriceImpactAmount.toString()}`);
        console.log(`\n`);
    }

    console.log(`═`.repeat(80));
    console.log(`\n4️⃣  COMPARISON\n`);

    console.log(`📊 Execution Price Comparison:`);
    console.log(`\n   Source 1: Calculated from Reader/DataStore`);
    console.log(`   Formula:  sizeInUsd / (sizeInTokens + pendingImpactAmount)`);
    console.log(`   Result:   ${ethers.utils.formatUnits(calculatedExecutionPrice, 12)}`);
    console.log(`   Raw:      ${calculatedExecutionPrice.toString()}\n`);

    if (matchingEvent) {
        console.log(`   Source 2: PositionIncrease Event`);
        console.log(`   Field:    executionPrice`);
        console.log(`   Result:   ${ethers.utils.formatUnits(matchingEvent.executionPrice, 12)}`);
        console.log(`   Raw:      ${matchingEvent.executionPrice.toString()}\n`);

        const match = calculatedExecutionPrice.eq(matchingEvent.executionPrice);
        const diff = calculatedExecutionPrice.sub(matchingEvent.executionPrice);
        const diffFormatted = ethers.utils.formatUnits(diff.abs(), 12);

        console.log(`   ${match ? '✅' : '❌'} Match: ${match ? 'YES' : 'NO'}`);
        if (!match) {
            console.log(`   Difference: ${diffFormatted}`);
        }
    } else {
        console.log(`   Source 2: PositionIncrease Event - NOT AVAILABLE`);
    }

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`\n✅ Verification complete!\n`);

    if (matchingEvent && calculatedExecutionPrice.eq(matchingEvent.executionPrice)) {
        console.log(`🎉 SUCCESS: The execution price calculated from Reader/DataStore matches`);
        console.log(`   the execution price from the PositionIncrease event!\n`);
        console.log(`📝 This confirms that the frontend can calculate the correct entry price`);
        console.log(`   (with price impact included) using only Reader/DataStore data:\n`);
        console.log(`   entryPrice = sizeInUsd / (sizeInTokens ${isLong ? '+' : '-'} pendingImpactAmount)\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
