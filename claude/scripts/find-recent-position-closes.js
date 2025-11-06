const { ethers } = require("hardhat");

/**
 * Find Recent Position Closes for Account
 *
 * This script queries the EventEmitter contract for historical PositionDecrease events
 * for a specific account, then analyzes the most recent one.
 *
 * Usage:
 * npx hardhat run claude/scripts/find-recent-position-closes.js --network arbitrumSepolia
 */

async function main() {
    // ============ CONFIGURATION ============
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44"; // <-- UPDATE THIS
    const LOOKBACK_BLOCKS = 1000000; // How far back to search (default: ~1M blocks)
    const ANALYZE_LATEST = true; // Automatically analyze the most recent close

    const ADDRESSES = {
        EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C", // From marks-arbitrumSepolia-deployments.md
        mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    };

    const MARKETS = {
        "0x8ae559448a1482faffC925eF6a233276588348Df": "TSLA",
        "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69": "USDTARS",
        "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C": "NVDA",
        "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383": "USDTPKR",
        "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44": "USDTCOP",
        "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449": "AAPL",
        "0xafd908D358315efDBA493311AbE30648DEC4d2dE": "META",
        "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb": "USDTNGN",
    };

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         FIND RECENT POSITION CLOSES FOR ACCOUNT                  ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    console.log(`🔍 Searching for position closes...`);
    console.log(`   Account: ${ACCOUNT_ADDRESS}`);
    console.log(`   Lookback: ${LOOKBACK_BLOCKS} blocks`);

    // Get current block
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - LOOKBACK_BLOCKS;

    console.log(`   Current Block: ${currentBlock}`);
    console.log(`   Searching from block: ${fromBlock}`);

    // ============ QUERY FOR POSITION DECREASE EVENTS ============
    console.log("\n📊 Querying EventEmitter for PositionDecrease events...");
    console.log("─".repeat(70));

    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);

    // Use hardcoded EventLog1 signature (matches Python implementation)
    const EVENT_LOG1_SIG = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    // Query for ALL EventLog1 events (we'll filter by account in code)
    const filter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [EVENT_LOG1_SIG]
    };

    console.log(`Fetching events... (this may take a moment)`);
    const logs = await ethers.provider.getLogs(filter);
    console.log(`✅ Found ${logs.length} total events`);

    // ============ PARSE EVENTS ============
    console.log("\n📋 Parsing events...");
    console.log("─".repeat(70));

    const eventEmitterInterface = eventEmitter.interface;
    const positionDecreases = [];
    const positionFees = new Map(); // Map orderKey -> fees

    for (const log of logs) {
        try {
            const parsed = eventEmitterInterface.parseLog(log);

            if (parsed.name === "EventLog1") {
                // Access by numeric index (ethers.js issue with complex structs)
                const eventName = parsed.args[1];      // string eventName
                const eventData = parsed.args[4];      // EventLogData struct

                // Collect PositionDecrease events
                if (eventName === "PositionDecrease") {
                    if (!eventData || !eventData.addressItems) continue;

                    const addressItems = eventData.addressItems;
                    const account = addressItems.items[0].value;

                    // Filter by account
                    if (account.toLowerCase() !== ACCOUNT_ADDRESS.toLowerCase()) {
                        continue;
                    }
                    const uintItems = eventData.uintItems;
                    const intItems = eventData.intItems;
                    const boolItems = eventData.boolItems;
                    const bytes32Items = eventData.bytes32Items;

                    const decreaseData = {
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
                        isLong: boolItems.items[0].value,
                    };

                    positionDecreases.push(decreaseData);
                }

                // Collect PositionFeesCollected events
                if (eventName === "PositionFeesCollected") {
                    const bytes32Items = eventData.bytes32Items;
                    const uintItems = eventData.uintItems;

                    const orderKey = bytes32Items.items[0].value;

                    positionFees.set(orderKey, {
                        fundingFeeAmount: uintItems.items[3].value,
                        claimableLongTokenAmount: uintItems.items[4].value,
                        claimableShortTokenAmount: uintItems.items[5].value,
                        borrowingFeeUsd: uintItems.items[9].value,
                        positionFeeAmount: uintItems.items[19].value,
                        totalCostAmount: uintItems.items[20].value,
                    });
                }
            }
        } catch (error) {
            // Skip unparseable events
        }
    }

    console.log(`✅ Found ${positionDecreases.length} PositionDecrease events`);
    console.log(`✅ Found ${positionFees.size} PositionFeesCollected events`);

    if (positionDecreases.length === 0) {
        console.log(`\n❌ No position closes found for this account in the last ${LOOKBACK_BLOCKS} blocks`);
        console.log(`\nTry increasing LOOKBACK_BLOCKS at the top of the script`);
        return;
    }

    // ============ DISPLAY ALL POSITION CLOSES ============
    console.log("\n\n📜 POSITION CLOSE HISTORY (Most Recent First)");
    console.log("═".repeat(70));

    // Sort by block number (most recent first)
    positionDecreases.sort((a, b) => b.blockNumber - a.blockNumber);

    for (let i = 0; i < positionDecreases.length; i++) {
        const decrease = positionDecreases[i];
        const marketName = MARKETS[decrease.market.toLowerCase()] || "UNKNOWN";
        const sizeDeltaUsd = ethers.utils.formatUnits(decrease.sizeDeltaUsd, 30);
        const collateralDelta = ethers.utils.formatUnits(decrease.collateralDeltaAmount, 6);
        const basePnl = ethers.utils.formatUnits(decrease.basePnlUsd, 30);

        console.log(`\n${i + 1}. Block ${decrease.blockNumber} - ${marketName} ${decrease.isLong ? 'LONG' : 'SHORT'}`);
        console.log(`   Tx: ${decrease.transactionHash}`);
        console.log(`   Size Decreased: $${parseFloat(sizeDeltaUsd).toFixed(2)}`);
        console.log(`   Collateral Released: ${parseFloat(collateralDelta).toFixed(2)} mUSD`);
        console.log(`   Base PnL: ${parseFloat(basePnl) >= 0 ? '+' : ''}$${parseFloat(basePnl).toFixed(2)}`);
    }

    // ============ ANALYZE MOST RECENT ============
    if (ANALYZE_LATEST && positionDecreases.length > 0) {
        console.log("\n\n" + "═".repeat(70));
        console.log("🔬 ANALYZING MOST RECENT POSITION CLOSE");
        console.log("═".repeat(70));

        const latest = positionDecreases[0];
        const fees = positionFees.get(latest.orderKey);
        const marketName = MARKETS[latest.market.toLowerCase()] || "UNKNOWN";

        console.log(`\n📍 Position Details:`);
        console.log(`   Market: ${marketName} ${latest.isLong ? 'LONG' : 'SHORT'}`);
        console.log(`   Block: ${latest.blockNumber}`);
        console.log(`   Transaction: ${latest.transactionHash}`);

        // Get transaction receipt for transfers
        const receipt = await ethers.provider.getTransactionReceipt(latest.transactionHash);

        // Extract transfers
        const TRANSFER_SIG = ethers.utils.id("Transfer(address,address,uint256)");
        let totalTransferred = ethers.BigNumber.from(0);

        for (const log of receipt.logs) {
            if (log.topics[0] === TRANSFER_SIG &&
                log.address.toLowerCase() === ADDRESSES.mUSD.toLowerCase()) {

                const to = '0x' + log.topics[2].slice(-40);
                const amount = ethers.BigNumber.from(log.data);

                if (to.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                    totalTransferred = totalTransferred.add(amount);
                }
            }
        }

        // Calculate expected payout
        const collateralDelta = parseFloat(ethers.utils.formatUnits(latest.collateralDeltaAmount, 6));
        const basePnl = parseFloat(ethers.utils.formatUnits(latest.basePnlUsd, 30));
        const priceImpact = parseFloat(ethers.utils.formatUnits(latest.priceImpactUsd, 30));

        let totalCost = 0;
        let claimableLong = 0;
        let claimableShort = 0;
        let borrowingFee = 0;
        let fundingFee = 0;
        let positionFee = 0;

        if (fees) {
            totalCost = parseFloat(ethers.utils.formatUnits(fees.totalCostAmount, 30));
            claimableLong = parseFloat(ethers.utils.formatUnits(fees.claimableLongTokenAmount, 6));
            claimableShort = parseFloat(ethers.utils.formatUnits(fees.claimableShortTokenAmount, 6));
            borrowingFee = parseFloat(ethers.utils.formatUnits(fees.borrowingFeeUsd, 30));
            fundingFee = parseFloat(ethers.utils.formatUnits(fees.fundingFeeAmount, 30));
            positionFee = parseFloat(ethers.utils.formatUnits(fees.positionFeeAmount, 6));
        }

        const totalClaimable = claimableLong + claimableShort;
        const expectedPayout = collateralDelta + basePnl + priceImpact - totalCost + totalClaimable;
        const actualPayout = parseFloat(ethers.utils.formatUnits(totalTransferred, 6));
        const difference = actualPayout - expectedPayout;
        const percentDiff = expectedPayout > 0 ? (difference / expectedPayout) * 100 : 0;

        console.log(`\n💰 Expected Payout Calculation:`);
        console.log(`   Collateral Delta:        ${collateralDelta >= 0 ? '+' : ''}${collateralDelta.toFixed(6)} mUSD`);
        console.log(`   + Base PnL:              ${basePnl >= 0 ? '+' : ''}${basePnl.toFixed(6)} USD`);
        console.log(`   + Price Impact:          ${priceImpact >= 0 ? '+' : ''}${priceImpact.toFixed(6)} USD`);
        console.log(`   - Total Fees:            -${totalCost.toFixed(6)} USD`);
        console.log(`   + Claimable Funding:     +${totalClaimable.toFixed(6)} mUSD`);
        console.log(`   ─────────────────────────────────────────────────`);
        console.log(`   = Expected Payout:       ${expectedPayout.toFixed(6)} mUSD`);

        console.log(`\n💸 Actual Payout:`);
        console.log(`   Total Transferred:       ${actualPayout.toFixed(6)} mUSD`);

        console.log(`\n📊 Reconciliation:`);
        console.log(`   ─────────────────────────────────────────────────`);
        console.log(`   Difference:              ${difference >= 0 ? '+' : ''}${difference.toFixed(6)} mUSD (${percentDiff >= 0 ? '+' : ''}${percentDiff.toFixed(3)}%)`);

        if (Math.abs(difference) < 0.01) {
            console.log(`\n   ✅ PERFECT MATCH!`);
        } else if (Math.abs(difference) < 1) {
            console.log(`\n   ✅ GOOD MATCH (< $1 difference)`);
        } else {
            console.log(`\n   ⚠️  DISCREPANCY DETECTED (> $1)`);
            console.log(`\n   Possible reasons:`);
            if (difference < 0) {
                console.log(`   - Additional execution fees`);
                console.log(`   - Keeper gas reimbursement`);
                console.log(`   - Hidden swap fees`);
            } else {
                console.log(`   - Fee rebates or discounts`);
                console.log(`   - Referral rewards`);
                console.log(`   - Multiple transfers combined`);
            }
        }

        if (fees) {
            console.log(`\n💳 Fee Breakdown:`);
            console.log(`   - Borrowing Fee:    ${borrowingFee.toFixed(6)} USD`);
            console.log(`   - Funding Fee:      ${fundingFee.toFixed(6)} USD`);
            console.log(`   - Position Fee:     ${positionFee.toFixed(6)} mUSD`);
            console.log(`   ─────────────────────────────────────────────────`);
            console.log(`   Total Fees:         ${totalCost.toFixed(6)} USD`);
        }
    }

    console.log("\n\n" + "═".repeat(70));
    console.log("✅ Analysis complete!");
    console.log("═".repeat(70) + "\n");

    console.log(`💡 To analyze a different close, update the transaction hash in:`);
    console.log(`   claude/scripts/reconcile-from-events.js`);
    console.log(`\n   Or run this script again with a different ACCOUNT_ADDRESS\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
