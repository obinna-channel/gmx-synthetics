const { ethers } = require("hardhat");

/**
 * Find Recent Position Closes - CORRECT VERSION
 *
 * Based on actual EventEmitter contract structure:
 * event EventLog1(address msgSender, string eventName, string indexed eventNameHash, bytes32 indexed topic1, EventUtils.EventLogData eventData)
 *
 * Topics are:
 * - topic0: event signature hash
 * - topic1: keccak256(eventName) - e.g., "PositionDecrease"
 * - topic2: topic1 parameter (account address as bytes32)
 */

async function main() {
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const LOOKBACK_BLOCKS = 800000;

    const ADDRESSES = {
        EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C",
        mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    };

    const MARKETS = {
        // From marks-arbitrumSepolia-deployments.md
        "0x53b49A28054D108d7050B0E5C317001bE984EB2D": "sNGN [USDT-sNGN]",
        "0xb1faf4aFd5bd6aA53CF056BBA31CCa1C44234a24": "sNGN [USDT-USDT]",
        "0x8E4C5f3296A100d4135187C3181258cb8a223bb1": "USDT [USDT-sNGN]",
        "0x2926c00ACE0D5915b222E4767D2D67CE960bFd2f": "mNGN [USDT-mNGN]",
        "0x2AE76b768a26CA2DfCcd7ccB46273D3C8283C2A7": "USDT [USDT-mNGN]",
        "0xD5e527b02d691054AEDd4733029aa06E895EA3CD": "mNGN [mNGN-USDT]",
        "0xf7F4Bb2014A164A919Ccec2b97Bd4805f86B83aD": "mUSD [mUSD-mNGN]",
        "0xb0D93252624e03138a261689eDE446F6BEd768BF": "mNGN [mUSD-mNGN]",
        "0x5E63276Caae0FF49b2762b98A1d37941AA50F804": "mUSDTNGN [mUSD-mNGN]",
        "0x784c2e2C5499853d052D339ed2834782C7C816b6": "mTSLA [USDT-USDT]",
        "0x8ae559448a1482faffC925eF6a233276588348Df": "mTSLA [mUSD-mUSD]",
        "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69": "mUSDTARS [mUSD-mUSD]",
        "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C": "mNVDA [mUSD-mUSD]",
        "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383": "mPKR [mUSD-mUSD]",
        "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44": "mCOP [mUSD-mUSD]",
        "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449": "mAAPL [mUSD-mUSD]",
        "0xafd908D358315efDBA493311AbE30648DEC4d2dE": "mMETA [mUSD-mUSD]",
        "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb": "mUSDTNGN [mUSD-mUSD]",
    };

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         FIND POSITION CLOSES - CORRECT QUERY                     ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - LOOKBACK_BLOCKS;

    console.log(`🔍 Configuration:`);
    console.log(`   Account: ${ACCOUNT_ADDRESS}`);
    console.log(`   Current Block: ${currentBlock}`);
    console.log(`   Searching from: ${fromBlock} (${LOOKBACK_BLOCKS} blocks back)\n`);

    // Use the hardcoded EventLog1 signature that actually works
    // (discovered from successful Python implementation)
    const eventLog1Topic0 = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    console.log(`📝 Event Signature:`);
    console.log(`   topic0: ${eventLog1Topic0}\n`);

    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);

    // Calculate topic1 for "PositionDecrease"
    const positionDecreaseHash = ethers.utils.id("PositionDecrease");

    // Calculate topic2 for account (Cast.toBytes32(address) = bytes32(uint256(uint160(address))))
    const accountBytes32 = ethers.utils.hexZeroPad(ACCOUNT_ADDRESS, 32);

    console.log(`🔎 Query Topics:`);
    console.log(`   topic0 (EventLog1): ${eventLog1Topic0}`);
    console.log(`   topic1 (PositionDecrease): ${positionDecreaseHash}`);
    console.log(`   topic2 (Account): ${accountBytes32}\n`);

    // Query for PositionDecrease events for this account
    console.log(`📊 Querying for PositionDecrease events...`);

    const filter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            eventLog1Topic0,        // EventLog1 signature
            positionDecreaseHash,   // "PositionDecrease"
            accountBytes32          // Account address
        ]
    };

    const logs = await ethers.provider.getLogs(filter);
    console.log(`   ✅ Found ${logs.length} PositionDecrease events\n`);

    if (logs.length === 0) {
        console.log(`❌ No PositionDecrease events found for this account`);
        console.log(`\nTrying without account filter to see if there are ANY PositionDecrease events...\n`);

        // Try without account filter
        const allDecreaseFilter = {
            address: ADDRESSES.EVENT_EMITTER,
            fromBlock: fromBlock,
            toBlock: currentBlock,
            topics: [
                eventLog1Topic0,
                positionDecreaseHash
            ]
        };

        const allLogs = await ethers.provider.getLogs(allDecreaseFilter);
        console.log(`   Found ${allLogs.length} total PositionDecrease events (all accounts)`);

        if (allLogs.length > 0) {
            console.log(`\n   Checking first few events to see accounts:`);
            for (let i = 0; i < Math.min(5, allLogs.length); i++) {
                const parsed = eventEmitter.interface.parseLog(allLogs[i]);
                const eventData = parsed.args.eventData;
                const account = eventData.addressItems.items[0].value;
                console.log(`   ${i + 1}. Block ${allLogs[i].blockNumber}: Account ${account}`);
            }
        }

        return;
    }

    // Also query for PositionFeesCollected events to get fee information
    // Like Python code: query all events, not filtered by account
    console.log(`📊 Querying for PositionFeesCollected events...`);

    const positionFeesHash = ethers.utils.id("PositionFeesCollected");
    const feesFilter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            eventLog1Topic0,
            positionFeesHash
            // Don't filter by account - get all and match by orderKey
        ]
    };

    const feeLogs = await ethers.provider.getLogs(feesFilter);
    console.log(`   ✅ Found ${feeLogs.length} PositionFeesCollected events\n`);

    // Helper function like Python code: search items by key name
    function getValueFromItems(items, key) {
        if (!items || !items.items) return null;
        for (const item of items.items) {
            if (item.key === key) {
                return item.value;
            }
        }
        return null;
    }

    // Build a map of orderKey -> fees (using key-based lookup like Python)
    const feesByOrderKey = new Map();
    for (const log of feeLogs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventData = parsed.args[4]; // EventLogData struct

            if (!eventData || !eventData.bytes32Items) continue;

            const orderKey = getValueFromItems(eventData.bytes32Items, 'orderKey');
            if (!orderKey) continue;

            feesByOrderKey.set(orderKey, {
                fundingFeeAmount: getValueFromItems(eventData.uintItems, 'fundingFeeAmount'),
                claimableLongTokenAmount: getValueFromItems(eventData.uintItems, 'claimableLongTokenAmount'),
                claimableShortTokenAmount: getValueFromItems(eventData.uintItems, 'claimableShortTokenAmount'),
                borrowingFeeUsd: getValueFromItems(eventData.uintItems, 'borrowingFeeUsd'),
                borrowingFeeAmount: getValueFromItems(eventData.uintItems, 'borrowingFeeAmount'),
                positionFeeAmount: getValueFromItems(eventData.uintItems, 'positionFeeAmount'),
                uiFeeAmount: getValueFromItems(eventData.uintItems, 'uiFeeAmount'),
                liquidationFeeAmount: getValueFromItems(eventData.uintItems, 'liquidationFeeAmount'),
                totalCostAmount: getValueFromItems(eventData.uintItems, 'totalCostAmount'),
            });
        } catch (error) {
            // Skip unparseable
        }
    }

    // Parse and display results
    console.log(`═`.repeat(70));
    console.log(`\n📜 POSITION CLOSES (Most Recent First)\n`);

    const positionCloses = [];

    for (const log of logs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);

            if (!parsed || !parsed.args) {
                console.log(`⚠️  Skipping log - no args found`);
                continue;
            }

            // Access by numeric index (ethers.js doesn't provide named access for complex structs)
            // EventLog1(address msgSender, string eventName, string indexed eventNameHash, bytes32 indexed topic1, EventLogData eventData)
            const msgSender = parsed.args[0];      // address
            const eventName = parsed.args[1];      // string
            const eventNameHash = parsed.args[2];  // string (indexed)
            const topic1 = parsed.args[3];         // bytes32 (indexed)
            const eventData = parsed.args[4];      // EventLogData struct

            if (!eventData || !eventData.addressItems) {
                console.log(`⚠️  Skipping - no eventData structure`);
                continue;
            }

            const addressItems = eventData.addressItems;
            const uintItems = eventData.uintItems;
            const intItems = eventData.intItems;
            const boolItems = eventData.boolItems;
            const bytes32Items = eventData.bytes32Items;

            positionCloses.push({
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                orderKey: bytes32Items.items[0].value,
                positionKey: bytes32Items.items[1].value,
                account: addressItems.items[0].value,
                market: addressItems.items[1].value,
                collateralToken: addressItems.items[2].value,
                sizeDeltaUsd: uintItems.items[12].value,
                collateralDeltaAmount: uintItems.items[14].value,
                basePnlUsd: intItems.items[1].value,
                priceImpactUsd: intItems.items[0].value,
                proportionalPendingImpactUsd: intItems.items[3].value, // Component of totalImpactUsd
                totalImpactUsd: intItems.items[4].value, // IMPORTANT: Use this for payout calculation!
                isLong: boolItems.items[0].value,
            });
        } catch (error) {
            console.log(`❌ Error parsing log:`, error.message);
        }
    }

    // Sort by block (most recent first)
    positionCloses.sort((a, b) => b.blockNumber - a.blockNumber);

    // Prepare data for table display
    const tableData = [];
    for (let i = 0; i < positionCloses.length; i++) {
        const close = positionCloses[i];
        const marketName = MARKETS[close.market.toLowerCase()] || MARKETS[close.market] || `UNKNOWN`;
        const sizeDeltaUsd = ethers.utils.formatUnits(close.sizeDeltaUsd, 30);
        const collateralDelta = ethers.utils.formatUnits(close.collateralDeltaAmount, 6);
        const basePnl = ethers.utils.formatUnits(close.basePnlUsd, 30);
        const priceImpact = ethers.utils.formatUnits(close.priceImpactUsd, 30);
        const pendingImpact = ethers.utils.formatUnits(close.proportionalPendingImpactUsd, 30);
        const totalImpact = ethers.utils.formatUnits(close.totalImpactUsd, 30);

        const fees = feesByOrderKey.get(close.orderKey);
        let totalCostTokens = 0;
        let positionFeeTokens = 0;
        let borrowingFeeTokens = 0;
        let fundingFeeTokens = 0;
        let uiFeeTokens = 0;
        let liquidationFeeTokens = 0;
        let totalClaimable = 0;

        let claimableLong = 0;
        let claimableShort = 0;
        let claimableFunding = 0;
        let claimableType = '';

        if (fees) {
            totalCostTokens = parseFloat(ethers.utils.formatUnits(fees.totalCostAmount || 0, 6));
            positionFeeTokens = parseFloat(ethers.utils.formatUnits(fees.positionFeeAmount || 0, 6));
            borrowingFeeTokens = parseFloat(ethers.utils.formatUnits(fees.borrowingFeeAmount || 0, 6));
            fundingFeeTokens = parseFloat(ethers.utils.formatUnits(fees.fundingFeeAmount || 0, 6)); // IMPORTANT: 6 decimals (tokens), not 30 (USD)!
            uiFeeTokens = parseFloat(ethers.utils.formatUnits(fees.uiFeeAmount || 0, 6));
            liquidationFeeTokens = parseFloat(ethers.utils.formatUnits(fees.liquidationFeeAmount || 0, 6));
            claimableLong = parseFloat(ethers.utils.formatUnits(fees.claimableLongTokenAmount || 0, 6));
            claimableShort = parseFloat(ethers.utils.formatUnits(fees.claimableShortTokenAmount || 0, 6));
            totalClaimable = claimableLong + claimableShort;

            // Determine which claimable to show
            if (claimableLong > 0) {
                claimableFunding = claimableLong;
                claimableType = 'Long';
            } else if (claimableShort > 0) {
                claimableFunding = claimableShort;
                claimableType = 'Short';
            } else {
                claimableFunding = 0;
                claimableType = '';
            }
        }

        // Calculate net payout WITHOUT claimable funding (claimed separately)
        // IMPORTANT: Use totalImpact (not priceImpact) as that's what's actually charged
        const netPayout = parseFloat(collateralDelta) + parseFloat(basePnl) + parseFloat(totalImpact) - totalCostTokens;

        tableData.push({
            position: `Pos ${i + 1}`,
            market: marketName,
            side: close.isLong ? 'LONG' : 'SHORT',
            block: close.blockNumber,
            tx: close.transactionHash,
            sizeDelta: parseFloat(sizeDeltaUsd),
            collateral: parseFloat(collateralDelta),
            basePnl: parseFloat(basePnl),
            priceImpact: parseFloat(priceImpact),
            pendingImpact: parseFloat(pendingImpact),
            totalImpact: parseFloat(totalImpact),
            positionFee: positionFeeTokens,
            borrowingFee: borrowingFeeTokens,
            fundingFee: fundingFeeTokens,
            uiFee: uiFeeTokens,
            liquidationFee: liquidationFeeTokens,
            totalFees: totalCostTokens,
            netPayout: netPayout,
            claimableFunding: claimableFunding,
            claimableType: claimableType
        });
    }

    // Print main summary table
    console.log(`\n${'═'.repeat(170)}`);
    console.log(`| Pos    | Market        | Side  | Collateral | Base PnL   | Total Impact | Total Fees | Net Payout | Claimable  |`);
    console.log(`|--------|---------------|-------|------------|------------|--------------|------------|------------|------------|`);

    // Print table rows
    for (const row of tableData) {
        const pos = row.position.padEnd(6);
        const market = row.market.slice(0, 13).padEnd(13);
        const side = row.side.padEnd(5);
        const collateral = `+${row.collateral.toFixed(2)}`.padStart(10);
        const basePnl = `${row.basePnl >= 0 ? '+' : ''}${row.basePnl.toFixed(2)}`.padStart(10);
        const totalImpact = `${row.totalImpact >= 0 ? '+' : ''}${row.totalImpact.toFixed(2)}`.padStart(12);
        const totalFees = `-${row.totalFees.toFixed(2)}`.padStart(10);
        const netPayout = `${row.netPayout >= 0 ? '+' : ''}${row.netPayout.toFixed(2)}`.padStart(10);

        let claimable = '';
        if (row.claimableFunding > 0) {
            claimable = `+${row.claimableFunding.toFixed(2)} ${row.claimableType}`.padStart(10);
        } else {
            claimable = `0`.padStart(10);
        }

        console.log(`| ${pos} | ${market} | ${side} | ${collateral} | ${basePnl} | ${totalImpact} | ${totalFees} | ${netPayout} | ${claimable} |`);
    }

    console.log(`${'═'.repeat(170)}`);
    console.log(`\n* Claimable funding is claimed in a separate transaction and NOT included in Net Payout`);
    console.log(`\n\n${'═'.repeat(170)}`);
    console.log(`\n📊 DETAILED BREAKDOWN\n`);
    console.log(`${'═'.repeat(170)}`);

    // Print detailed breakdown for each position
    for (const row of tableData) {
        console.log(`\n${row.position} - ${row.market} ${row.side}`);
        console.log(`${'─'.repeat(70)}`);

        console.log(`\nTOTAL IMPACT BREAKDOWN (${row.totalImpact >= 0 ? '+' : ''}${row.totalImpact.toFixed(2)} USD):`);
        console.log(`  Price Impact:            ${row.priceImpact >= 0 ? '+' : ''}${row.priceImpact.toFixed(6)} USD`);
        console.log(`  Pending Impact:          ${row.pendingImpact >= 0 ? '+' : ''}${row.pendingImpact.toFixed(6)} USD`);
        console.log(`  ────────────────────────────────────────`);
        console.log(`  = Total Impact:          ${row.totalImpact >= 0 ? '+' : ''}${row.totalImpact.toFixed(6)} USD`);

        console.log(`\nTOTAL FEES BREAKDOWN (${row.totalFees.toFixed(2)} mUSD):`);
        console.log(`  Position Fee:            +${row.positionFee.toFixed(6)} mUSD`);
        console.log(`  Borrowing Fee:           +${row.borrowingFee.toFixed(6)} mUSD`);
        console.log(`  Funding Fee:             +${row.fundingFee.toFixed(6)} mUSD`);
        console.log(`  UI Fee:                  +${row.uiFee.toFixed(6)} mUSD`);
        console.log(`  Liquidation Fee:         +${row.liquidationFee.toFixed(6)} mUSD`);
        console.log(`  ────────────────────────────────────────`);
        console.log(`  = Total Fees:            ${row.totalFees.toFixed(6)} mUSD`);

        const calculatedTotal = row.positionFee + row.borrowingFee + row.fundingFee + row.uiFee + row.liquidationFee;
        const match = Math.abs(calculatedTotal - row.totalFees) < 0.01;
        console.log(`  Verification: ${calculatedTotal.toFixed(6)} ${match ? '✅' : '❌'}`);
    }

    console.log(`\n${'═'.repeat(170)}`);
    console.log(`\nTransaction Hashes:`);
    for (let i = 0; i < tableData.length; i++) {
        console.log(`  Pos ${i + 1}: ${tableData[i].tx}`);;
    }

    console.log(`═`.repeat(70));
    console.log(`✅ Found ${positionCloses.length} position closes!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
