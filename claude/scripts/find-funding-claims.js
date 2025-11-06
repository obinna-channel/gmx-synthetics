const { ethers } = require("hardhat");

/**
 * Find Funding Claims and Match with Position Closes
 *
 * This script:
 * 1. Queries FundingFeesClaimed events for the account
 * 2. Queries PositionDecrease and PositionFeesCollected events
 * 3. Matches claimable amounts from position closes with actual claims
 * 4. Identifies discrepancies
 */

async function main() {
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const LOOKBACK_BLOCKS = 100000;

    const ADDRESSES = {
        EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C",
        mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    };

    const MARKETS = {
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
    console.log("║         FUNDING CLAIMS INVESTIGATION                             ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - LOOKBACK_BLOCKS;

    console.log(`🔍 Configuration:`);
    console.log(`   Account: ${ACCOUNT_ADDRESS}`);
    console.log(`   Current Block: ${currentBlock}`);
    console.log(`   Searching from: ${fromBlock} (${LOOKBACK_BLOCKS} blocks back)\n`);

    const eventLog1Topic0 = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';
    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);
    const accountBytes32 = ethers.utils.hexZeroPad(ACCOUNT_ADDRESS, 32);

    // Helper function to extract values from items arrays
    function getValueFromItems(items, key) {
        if (!items || !items.items) return null;
        for (const item of items.items) {
            if (item.key === key) {
                return item.value;
            }
        }
        return null;
    }

    // ========================================================================
    // STEP 1: Query FundingFeesClaimed Events
    // ========================================================================
    console.log(`📊 STEP 1: Querying FundingFeesClaimed events...`);

    const fundingClaimedHash = ethers.utils.id("FundingFeesClaimed");
    const fundingClaimedFilter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            eventLog1Topic0,
            fundingClaimedHash,
            accountBytes32  // Account is topic2
        ]
    };

    const fundingClaimedLogs = await ethers.provider.getLogs(fundingClaimedFilter);
    console.log(`   ✅ Found ${fundingClaimedLogs.length} FundingFeesClaimed events\n`);

    const fundingClaims = [];
    for (const log of fundingClaimedLogs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventData = parsed.args[4];

            const market = getValueFromItems(eventData.addressItems, 'market');
            const token = getValueFromItems(eventData.addressItems, 'token');
            const account = getValueFromItems(eventData.addressItems, 'account');
            const receiver = getValueFromItems(eventData.addressItems, 'receiver');
            const amount = getValueFromItems(eventData.uintItems, 'amount');
            const nextPoolValue = getValueFromItems(eventData.uintItems, 'nextPoolValue');

            fundingClaims.push({
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                market,
                token,
                account,
                receiver,
                amount,
                nextPoolValue
            });
        } catch (error) {
            console.log(`❌ Error parsing FundingFeesClaimed event:`, error.message);
        }
    }

    // Sort by block (most recent first)
    fundingClaims.sort((a, b) => b.blockNumber - a.blockNumber);

    // ========================================================================
    // STEP 2: Query ClaimableFundingUpdated Events (to see accumulation)
    // ========================================================================
    console.log(`📊 STEP 2: Querying ClaimableFundingUpdated events...`);

    const claimableFundingUpdatedHash = ethers.utils.id("ClaimableFundingUpdated");
    const claimableUpdatedFilter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            eventLog1Topic0,
            claimableFundingUpdatedHash,
            accountBytes32  // Account is topic2
        ]
    };

    const claimableUpdatedLogs = await ethers.provider.getLogs(claimableUpdatedFilter);
    console.log(`   ✅ Found ${claimableUpdatedLogs.length} ClaimableFundingUpdated events\n`);

    const fundingUpdates = [];
    for (const log of claimableUpdatedLogs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventData = parsed.args[4];

            const market = getValueFromItems(eventData.addressItems, 'market');
            const token = getValueFromItems(eventData.addressItems, 'token');
            const account = getValueFromItems(eventData.addressItems, 'account');
            const timeKey = getValueFromItems(eventData.uintItems, 'timeKey');
            const delta = getValueFromItems(eventData.uintItems, 'delta');
            const nextValue = getValueFromItems(eventData.uintItems, 'nextValue');

            fundingUpdates.push({
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                market,
                token,
                account,
                timeKey,
                delta,
                nextValue
            });
        } catch (error) {
            console.log(`❌ Error parsing ClaimableFundingUpdated event:`, error.message);
        }
    }

    // Sort by block (most recent first)
    fundingUpdates.sort((a, b) => b.blockNumber - a.blockNumber);

    // ========================================================================
    // STEP 3: Query PositionDecrease Events
    // ========================================================================
    console.log(`📊 STEP 3: Querying PositionDecrease events...`);

    const positionDecreaseHash = ethers.utils.id("PositionDecrease");
    const positionDecreaseFilter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            eventLog1Topic0,
            positionDecreaseHash,
            accountBytes32
        ]
    };

    const decreaseLogs = await ethers.provider.getLogs(positionDecreaseFilter);
    console.log(`   ✅ Found ${decreaseLogs.length} PositionDecrease events\n`);

    // ========================================================================
    // STEP 3: Query PositionFeesCollected Events (to get claimable amounts)
    // ========================================================================
    console.log(`📊 STEP 3: Querying PositionFeesCollected events...`);

    const positionFeesHash = ethers.utils.id("PositionFeesCollected");
    const feesFilter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            eventLog1Topic0,
            positionFeesHash
        ]
    };

    const feeLogs = await ethers.provider.getLogs(feesFilter);
    console.log(`   ✅ Found ${feeLogs.length} PositionFeesCollected events\n`);

    // Build map of orderKey -> fees
    const feesByOrderKey = new Map();
    for (const log of feeLogs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventData = parsed.args[4];

            const orderKey = getValueFromItems(eventData.bytes32Items, 'orderKey');
            if (!orderKey) continue;

            feesByOrderKey.set(orderKey, {
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                claimableLongTokenAmount: getValueFromItems(eventData.uintItems, 'claimableLongTokenAmount'),
                claimableShortTokenAmount: getValueFromItems(eventData.uintItems, 'claimableShortTokenAmount'),
            });
        } catch (error) {
            // Skip unparseable
        }
    }

    // Parse position decreases and match with fees
    const positionCloses = [];
    for (const log of decreaseLogs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventData = parsed.args[4];

            const orderKey = eventData.bytes32Items.items[0].value;
            const market = eventData.addressItems.items[1].value;
            const collateralToken = eventData.addressItems.items[2].value;

            const fees = feesByOrderKey.get(orderKey);

            positionCloses.push({
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                orderKey,
                market,
                collateralToken,
                claimableLongTokenAmount: fees?.claimableLongTokenAmount || ethers.BigNumber.from(0),
                claimableShortTokenAmount: fees?.claimableShortTokenAmount || ethers.BigNumber.from(0),
            });
        } catch (error) {
            console.log(`❌ Error parsing PositionDecrease:`, error.message);
        }
    }

    // Sort by block (most recent first)
    positionCloses.sort((a, b) => b.blockNumber - a.blockNumber);

    // ========================================================================
    // STEP 4: Display Claimable Funding Updates
    // ========================================================================
    console.log(`═`.repeat(170));
    console.log(`\n📜 CLAIMABLE FUNDING UPDATES (Most Recent First)\n`);
    console.log(`═`.repeat(170));

    if (fundingUpdates.length === 0) {
        console.log(`\n❌ No ClaimableFundingUpdated events found for this account\n`);
    } else {
        console.log(`\n| Update # | Block    | Market        | Token | Delta (tokens) | Next Value (tokens) | Tx Hash (first 10)          |`);
        console.log(`|----------|----------|---------------|-------|----------------|---------------------|----------------------------|`);

        for (let i = 0; i < fundingUpdates.length; i++) {
            const update = fundingUpdates[i];
            const marketName = MARKETS[update.market.toLowerCase()] || MARKETS[update.market] || `UNKNOWN`;
            const tokenName = update.token === ADDRESSES.mUSD ? 'mUSD' : 'UNKNOWN';
            const delta = ethers.utils.formatUnits(update.delta, 6);
            const nextValue = ethers.utils.formatUnits(update.nextValue, 6);
            const txShort = update.transactionHash.slice(0, 12);

            console.log(`| ${String(i + 1).padStart(8)} | ${update.blockNumber.toString().padStart(8)} | ${marketName.slice(0, 13).padEnd(13)} | ${tokenName.padEnd(5)} | ${delta.padStart(14)} | ${nextValue.padStart(19)} | ${txShort.padEnd(26)} |`);
        }
    }

    // ========================================================================
    // STEP 5: Display Funding Claims
    // ========================================================================
    console.log(`\n\n═`.repeat(150));
    console.log(`\n📜 FUNDING CLAIMS (Most Recent First)\n`);
    console.log(`═`.repeat(150));

    if (fundingClaims.length === 0) {
        console.log(`\n❌ No FundingFeesClaimed events found for this account\n`);
    } else {
        console.log(`\n| Claim # | Block    | Market        | Token | Amount (tokens) | Tx Hash (first 10)          |`);
        console.log(`|---------|----------|---------------|-------|-----------------|----------------------------|`);

        for (let i = 0; i < fundingClaims.length; i++) {
            const claim = fundingClaims[i];
            const marketName = MARKETS[claim.market.toLowerCase()] || MARKETS[claim.market] || `UNKNOWN`;
            const tokenName = claim.token === ADDRESSES.mUSD ? 'mUSD' : 'UNKNOWN';
            const amount = ethers.utils.formatUnits(claim.amount, 6);
            const txShort = claim.transactionHash.slice(0, 12);

            console.log(`| ${String(i + 1).padStart(7)} | ${claim.blockNumber.toString().padStart(8)} | ${marketName.slice(0, 13).padEnd(13)} | ${tokenName.padEnd(5)} | ${amount.padStart(15)} | ${txShort.padEnd(26)} |`);
        }
    }

    // ========================================================================
    // STEP 6: Display Position Closes with Claimable Amounts
    // ========================================================================
    console.log(`\n\n═`.repeat(150));
    console.log(`\n📜 POSITION CLOSES WITH CLAIMABLE FUNDING (Most Recent First)\n`);
    console.log(`═`.repeat(150));

    console.log(`\n| Pos # | Block    | Market        | Claimable Long (tokens) | Claimable Short (tokens) | Tx Hash (first 10)          |`);
    console.log(`|-------|----------|---------------|-------------------------|--------------------------|----------------------------|`);

    for (let i = 0; i < positionCloses.length; i++) {
        const close = positionCloses[i];
        const marketName = MARKETS[close.market.toLowerCase()] || MARKETS[close.market] || `UNKNOWN`;
        const claimableLong = ethers.utils.formatUnits(close.claimableLongTokenAmount, 6);
        const claimableShort = ethers.utils.formatUnits(close.claimableShortTokenAmount, 6);
        const txShort = close.transactionHash.slice(0, 12);

        console.log(`| ${String(i + 1).padStart(5)} | ${close.blockNumber.toString().padStart(8)} | ${marketName.slice(0, 13).padEnd(13)} | ${claimableLong.padStart(23)} | ${claimableShort.padStart(24)} | ${txShort.padEnd(26)} |`);
    }

    // ========================================================================
    // STEP 7: Match Claims with Position Closes
    // ========================================================================
    console.log(`\n\n═`.repeat(150));
    console.log(`\n📊 MATCHING ANALYSIS\n`);
    console.log(`═`.repeat(150));

    console.log(`\nTotal Position Closes: ${positionCloses.length}`);
    console.log(`Total Funding Claims: ${fundingClaims.length}\n`);

    // Calculate total claimable from position closes
    let totalClaimableLong = ethers.BigNumber.from(0);
    let totalClaimableShort = ethers.BigNumber.from(0);

    for (const close of positionCloses) {
        totalClaimableLong = totalClaimableLong.add(close.claimableLongTokenAmount);
        totalClaimableShort = totalClaimableShort.add(close.claimableShortTokenAmount);
    }

    const totalClaimable = totalClaimableLong.add(totalClaimableShort);

    // Calculate total actually claimed
    let totalClaimed = ethers.BigNumber.from(0);
    for (const claim of fundingClaims) {
        totalClaimed = totalClaimed.add(claim.amount);
    }

    console.log(`Claimable from Position Closes:`);
    console.log(`  Long Token:  ${ethers.utils.formatUnits(totalClaimableLong, 6)} tokens`);
    console.log(`  Short Token: ${ethers.utils.formatUnits(totalClaimableShort, 6)} tokens`);
    console.log(`  TOTAL:       ${ethers.utils.formatUnits(totalClaimable, 6)} tokens`);

    console.log(`\nActually Claimed:`);
    console.log(`  TOTAL:       ${ethers.utils.formatUnits(totalClaimed, 6)} tokens`);

    const difference = totalClaimable.sub(totalClaimed);
    console.log(`\nDifference (Claimable - Claimed):`);
    console.log(`  ${ethers.utils.formatUnits(difference, 6)} tokens`);

    if (difference.gt(ethers.BigNumber.from(1000))) { // More than 0.001 token difference
        console.log(`  ⚠️  DISCREPANCY DETECTED!`);
    } else {
        console.log(`  ✅ Amounts match within rounding`);
    }

    // ========================================================================
    // STEP 8: Block-by-Block Timeline
    // ========================================================================
    console.log(`\n\n═`.repeat(150));
    console.log(`\n📅 TIMELINE (Block-by-Block)\n`);
    console.log(`═`.repeat(150));

    // Combine all events into timeline
    const timeline = [];

    for (const update of fundingUpdates) {
        const delta = parseFloat(ethers.utils.formatUnits(update.delta, 6));
        const nextValue = parseFloat(ethers.utils.formatUnits(update.nextValue, 6));
        timeline.push({
            blockNumber: update.blockNumber,
            type: 'Funding Updated',
            market: MARKETS[update.market.toLowerCase()] || 'UNKNOWN',
            amount: delta,
            details: `+${delta.toFixed(2)} -> Balance: ${nextValue.toFixed(2)}`,
            tx: update.transactionHash
        });
    }

    for (const close of positionCloses) {
        const claimableLong = parseFloat(ethers.utils.formatUnits(close.claimableLongTokenAmount, 6));
        const claimableShort = parseFloat(ethers.utils.formatUnits(close.claimableShortTokenAmount, 6));
        const totalClaimable = claimableLong + claimableShort;

        timeline.push({
            blockNumber: close.blockNumber,
            type: 'Position Close',
            market: MARKETS[close.market.toLowerCase()] || 'UNKNOWN',
            amount: totalClaimable,
            details: `Claimable: ${claimableLong.toFixed(2)} L + ${claimableShort.toFixed(2)} S`,
            tx: close.transactionHash
        });
    }

    for (const claim of fundingClaims) {
        const amount = parseFloat(ethers.utils.formatUnits(claim.amount, 6));
        timeline.push({
            blockNumber: claim.blockNumber,
            type: 'Funding Claimed',
            market: MARKETS[claim.market.toLowerCase()] || 'UNKNOWN',
            amount: amount,
            details: `Claimed: ${amount.toFixed(2)} tokens`,
            tx: claim.transactionHash
        });
    }

    // Sort by block number (oldest first for timeline)
    timeline.sort((a, b) => a.blockNumber - b.blockNumber);

    console.log(`\n| Block    | Event Type      | Market        | Amount     | Details                              | Tx (first 10)              |`);
    console.log(`|----------|-----------------|---------------|------------|--------------------------------------|----------------------------|`);

    for (const event of timeline) {
        const blockStr = event.blockNumber.toString().padStart(8);
        const typeStr = event.type.padEnd(15);
        const marketStr = event.market.slice(0, 13).padEnd(13);
        const amountStr = event.amount.toFixed(2).padStart(10);
        const detailsStr = event.details.slice(0, 36).padEnd(36);
        const txStr = event.tx.slice(0, 12).padEnd(26);

        console.log(`| ${blockStr} | ${typeStr} | ${marketStr} | ${amountStr} | ${detailsStr} | ${txStr} |`);
    }

    console.log(`\n═`.repeat(150));
    console.log(`\n✅ Analysis complete!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
