const { ethers } = require("hardhat");

/**
 * Check PositionIncrease Event Data
 *
 * Compares executionPrice from event vs calculated prices from sizeDeltaUsd/sizeDeltaInTokens
 * and sizeInUsd/sizeInTokens to understand where entry price should come from
 */

async function main() {
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const MARKET_ADDRESS = "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb"; // mUSDTNGN [mUSD-mUSD]
    const LOOKBACK_BLOCKS = 400000;

    const ADDRESSES = {
        EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C",
    };

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         CHECK POSITION INCREASE EVENT                            ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - LOOKBACK_BLOCKS;

    console.log(`🔍 Configuration:`);
    console.log(`   Account: ${ACCOUNT_ADDRESS}`);
    console.log(`   Market: ${MARKET_ADDRESS}`);
    console.log(`   Current Block: ${currentBlock}`);
    console.log(`   Searching from: ${fromBlock} (${LOOKBACK_BLOCKS} blocks back)\n`);

    const eventLog1Topic0 = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';
    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);

    // Calculate topics for "PositionIncrease"
    const positionIncreaseHash = ethers.utils.id("PositionIncrease");
    const accountBytes32 = ethers.utils.hexZeroPad(ACCOUNT_ADDRESS, 32);

    console.log(`🔎 Query Topics:`);
    console.log(`   topic0 (EventLog1): ${eventLog1Topic0}`);
    console.log(`   topic1 (PositionIncrease): ${positionIncreaseHash}`);
    console.log(`   topic2 (Account): ${accountBytes32}\n`);

    // Query for PositionIncrease events
    console.log(`📊 Querying for PositionIncrease events...`);

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
    console.log(`   ✅ Found ${logs.length} PositionIncrease events\n`);

    if (logs.length === 0) {
        console.log(`❌ No PositionIncrease events found for this account`);
        return;
    }

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

    console.log(`═`.repeat(80));
    console.log(`\n📜 POSITION INCREASES\n`);

    const positionIncreases = [];

    for (const log of logs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventData = parsed.args[4]; // EventLogData struct

            if (!eventData || !eventData.addressItems) {
                continue;
            }

            const market = getValueFromItems(eventData.addressItems, 'market');

            // Filter by market
            if (market.toLowerCase() !== MARKET_ADDRESS.toLowerCase()) {
                continue;
            }

            const account = getValueFromItems(eventData.addressItems, 'account');
            const collateralToken = getValueFromItems(eventData.addressItems, 'collateralToken');

            const sizeInUsd = getValueFromItems(eventData.uintItems, 'sizeInUsd');
            const sizeInTokens = getValueFromItems(eventData.uintItems, 'sizeInTokens');
            const collateralAmount = getValueFromItems(eventData.uintItems, 'collateralAmount');
            const executionPrice = getValueFromItems(eventData.uintItems, 'executionPrice');
            const sizeDeltaUsd = getValueFromItems(eventData.uintItems, 'sizeDeltaUsd');
            const sizeDeltaInTokens = getValueFromItems(eventData.uintItems, 'sizeDeltaInTokens');
            const indexTokenPriceMax = getValueFromItems(eventData.uintItems, 'indexTokenPrice.max');
            const indexTokenPriceMin = getValueFromItems(eventData.uintItems, 'indexTokenPrice.min');

            const pendingPriceImpactUsd = getValueFromItems(eventData.intItems, 'pendingPriceImpactUsd');
            const pendingPriceImpactAmount = getValueFromItems(eventData.intItems, 'pendingPriceImpactAmount');

            const isLong = getValueFromItems(eventData.boolItems, 'isLong');

            positionIncreases.push({
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                account,
                market,
                collateralToken,
                sizeInUsd,
                sizeInTokens,
                collateralAmount,
                executionPrice,
                sizeDeltaUsd,
                sizeDeltaInTokens,
                indexTokenPriceMax,
                indexTokenPriceMin,
                pendingPriceImpactUsd,
                pendingPriceImpactAmount,
                isLong
            });

        } catch (error) {
            console.log(`❌ Error parsing log:`, error.message);
        }
    }

    // Sort by block (most recent first)
    positionIncreases.sort((a, b) => b.blockNumber - a.blockNumber);

    console.log(`Found ${positionIncreases.length} position increases for this market\n`);
    console.log(`═`.repeat(80));

    // Analyze each position increase
    for (let i = 0; i < positionIncreases.length; i++) {
        const pos = positionIncreases[i];

        console.log(`\n\n📊 POSITION INCREASE #${i + 1}`);
        console.log(`${'─'.repeat(80)}`);
        console.log(`Block: ${pos.blockNumber}`);
        console.log(`Transaction: ${pos.transactionHash}`);
        console.log(`Side: ${pos.isLong ? 'LONG' : 'SHORT'}`);
        console.log(`\n`);

        // Event raw values
        console.log(`📝 RAW EVENT VALUES:`);
        console.log(`   sizeInUsd (30 decimals):        ${pos.sizeInUsd.toString()}`);
        console.log(`   sizeInTokens (18 decimals):     ${pos.sizeInTokens.toString()}`);
        console.log(`   sizeDeltaUsd (30 decimals):     ${pos.sizeDeltaUsd.toString()}`);
        console.log(`   sizeDeltaInTokens (18 decimals): ${pos.sizeDeltaInTokens.toString()}`);
        console.log(`   executionPrice (12 decimals):   ${pos.executionPrice.toString()}`);
        console.log(`   pendingPriceImpactUsd:          ${pos.pendingPriceImpactUsd.toString()}`);
        console.log(`   pendingPriceImpactAmount:       ${pos.pendingPriceImpactAmount.toString()}`);
        console.log(`\n`);

        // Formatted values
        const sizeInUsd_formatted = ethers.utils.formatUnits(pos.sizeInUsd, 30);
        const sizeInTokens_formatted = ethers.utils.formatUnits(pos.sizeInTokens, 18);
        const sizeDeltaUsd_formatted = ethers.utils.formatUnits(pos.sizeDeltaUsd, 30);
        const sizeDeltaInTokens_formatted = ethers.utils.formatUnits(pos.sizeDeltaInTokens, 18);
        const executionPrice_formatted = ethers.utils.formatUnits(pos.executionPrice, 12);
        const pendingImpactUsd_formatted = ethers.utils.formatUnits(pos.pendingPriceImpactUsd, 30);
        const indexPriceMax_formatted = ethers.utils.formatUnits(pos.indexTokenPriceMax, 12);
        const indexPriceMin_formatted = ethers.utils.formatUnits(pos.indexTokenPriceMin, 12);

        console.log(`📊 FORMATTED VALUES:`);
        console.log(`   sizeInUsd:           ${sizeInUsd_formatted} USD`);
        console.log(`   sizeInTokens:        ${sizeInTokens_formatted} tokens`);
        console.log(`   sizeDeltaUsd:        ${sizeDeltaUsd_formatted} USD`);
        console.log(`   sizeDeltaInTokens:   ${sizeDeltaInTokens_formatted} tokens`);
        console.log(`   executionPrice:      ${executionPrice_formatted}`);
        console.log(`   pendingImpactUsd:    ${pendingImpactUsd_formatted} USD`);
        console.log(`   indexPrice.max:      ${indexPriceMax_formatted}`);
        console.log(`   indexPrice.min:      ${indexPriceMin_formatted}`);
        console.log(`\n`);

        // Calculate prices using BigNumber division
        console.log(`🧮 PRICE CALCULATIONS:`);
        console.log(`\n1️⃣  executionPrice from event:`);
        console.log(`   ${executionPrice_formatted}`);

        console.log(`\n2️⃣  sizeDeltaUsd / sizeDeltaInTokens:`);
        const calcFromDelta = pos.sizeDeltaUsd.mul(ethers.BigNumber.from(10).pow(12)).div(pos.sizeDeltaInTokens);
        const calcFromDelta_formatted = ethers.utils.formatUnits(calcFromDelta, 12);
        console.log(`   ${calcFromDelta_formatted}`);

        console.log(`\n3️⃣  sizeInUsd / sizeInTokens (stored position):`);
        const calcFromSize = pos.sizeInUsd.mul(ethers.BigNumber.from(10).pow(12)).div(pos.sizeInTokens);
        const calcFromSize_formatted = ethers.utils.formatUnits(calcFromSize, 12);
        console.log(`   ${calcFromSize_formatted}`);

        console.log(`\n`);
        console.log(`📈 COMPARISON:`);
        console.log(`   executionPrice (from event):        ${executionPrice_formatted}`);
        console.log(`   sizeDeltaUsd / sizeDeltaInTokens:   ${calcFromDelta_formatted}`);
        console.log(`   sizeInUsd / sizeInTokens:           ${calcFromSize_formatted}`);

        // Calculate differences
        const diff_execution_vs_delta = parseFloat(executionPrice_formatted) - parseFloat(calcFromDelta_formatted);
        const diff_execution_vs_size = parseFloat(executionPrice_formatted) - parseFloat(calcFromSize_formatted);
        const diff_delta_vs_size = parseFloat(calcFromDelta_formatted) - parseFloat(calcFromSize_formatted);

        console.log(`\n🔍 DIFFERENCES:`);
        console.log(`   executionPrice - (sizeDeltaUsd/sizeDeltaInTokens): ${diff_execution_vs_delta.toFixed(6)}`);
        console.log(`   executionPrice - (sizeInUsd/sizeInTokens):         ${diff_execution_vs_size.toFixed(6)}`);
        console.log(`   (sizeDeltaUsd/sizeDeltaInTokens) - (sizeInUsd/sizeInTokens): ${diff_delta_vs_size.toFixed(6)}`);

        // Check if they match
        const tolerance = 0.0001;
        const execution_matches_delta = Math.abs(diff_execution_vs_delta) < tolerance;
        const execution_matches_size = Math.abs(diff_execution_vs_size) < tolerance;
        const delta_matches_size = Math.abs(diff_delta_vs_size) < tolerance;

        console.log(`\n✅ MATCHES (tolerance ${tolerance}):`);
        console.log(`   executionPrice === sizeDeltaUsd/sizeDeltaInTokens: ${execution_matches_delta ? '✅ YES' : '❌ NO'}`);
        console.log(`   executionPrice === sizeInUsd/sizeInTokens:         ${execution_matches_size ? '✅ YES' : '❌ NO'}`);
        console.log(`   sizeDeltaUsd/sizeDeltaInTokens === sizeInUsd/sizeInTokens: ${delta_matches_size ? '✅ YES' : '❌ NO'}`);

        console.log(`\n${'═'.repeat(80)}`);
    }

    console.log(`\n\n✅ Analysis complete!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
