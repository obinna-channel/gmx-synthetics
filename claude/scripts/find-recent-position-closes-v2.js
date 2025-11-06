const { ethers } = require("hardhat");

/**
 * Find Recent Position Closes for Account - Version 2
 *
 * This version queries ALL events without topic filtering,
 * then filters by account in code
 */

async function main() {
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const LOOKBACK_BLOCKS = 100000; // Start smaller for testing

    const ADDRESSES = {
        EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C",
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
    console.log("║    FIND RECENT POSITION CLOSES - V2 (No Topic Filtering)        ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - LOOKBACK_BLOCKS;

    console.log(`🔍 Configuration:`);
    console.log(`   Account: ${ACCOUNT_ADDRESS}`);
    console.log(`   Current Block: ${currentBlock}`);
    console.log(`   Searching from: ${fromBlock} (${LOOKBACK_BLOCKS} blocks back)`);

    // Query ALL EventLog1 events (no topic filtering)
    console.log("\n📊 Step 1: Querying ALL EventLog1 events...");

    // Use hardcoded EventLog1 signature (matches Python implementation)
    const EVENT_LOG1_SIG = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    const filter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [EVENT_LOG1_SIG]
    };

    console.log(`   Fetching events... (this may take a moment)`);
    const logs = await ethers.provider.getLogs(filter);
    console.log(`   ✅ Found ${logs.length} total EventLog1 events`);

    if (logs.length === 0) {
        console.log("\n❌ No events found at all! The EventEmitter might not have been used in this block range.");
        return;
    }

    // Parse and filter events
    console.log("\n📋 Step 2: Parsing and filtering events...");

    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);
    const eventEmitterInterface = eventEmitter.interface;

    const allEventTypes = new Set();
    const positionDecreases = [];
    const positionFees = new Map();

    let parseErrors = 0;

    for (const log of logs) {
        try {
            const parsed = eventEmitterInterface.parseLog(log);

            if (parsed.name === "EventLog1") {
                // Access by numeric index (ethers.js issue with complex structs)
                const eventName = parsed.args[1];      // string eventName
                const topic1 = parsed.args[3];         // bytes32 topic1
                const eventData = parsed.args[4];      // EventLogData struct

                allEventTypes.add(eventName);

                // For PositionDecrease, topic1 should be the account address as bytes32
                if (eventName === "PositionDecrease") {
                    const addressItems = eventData.addressItems;
                    const account = addressItems.items[0].value; // First address item is account

                    // Check if this decrease is for our account
                    if (account.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                        const uintItems = eventData.uintItems;
                        const intItems = eventData.intItems;
                        const boolItems = eventData.boolItems;
                        const bytes32Items = eventData.bytes32Items;

                        positionDecreases.push({
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
                        });
                    }
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
            parseErrors++;
        }
    }

    console.log(`   ✅ Parsed ${logs.length} events`);
    console.log(`   ⚠️  ${parseErrors} parse errors (expected for non-GMX events)`);
    console.log(`\n   Event types found: ${Array.from(allEventTypes).sort().join(", ")}`);
    console.log(`\n   ✅ Found ${positionDecreases.length} PositionDecrease events for account`);
    console.log(`   ✅ Found ${positionFees.size} PositionFeesCollected events`);

    if (positionDecreases.length === 0) {
        console.log(`\n❌ No position closes found for account ${ACCOUNT_ADDRESS}`);
        console.log(`\n   Try increasing LOOKBACK_BLOCKS in the script`);
        return;
    }

    // Display results
    console.log("\n\n📜 POSITION CLOSE HISTORY (Most Recent First)");
    console.log("═".repeat(70));

    positionDecreases.sort((a, b) => b.blockNumber - a.blockNumber);

    for (let i = 0; i < Math.min(10, positionDecreases.length); i++) {
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

    if (positionDecreases.length > 10) {
        console.log(`\n   ... and ${positionDecreases.length - 10} more`);
    }

    console.log("\n\n═".repeat(70));
    console.log(`✅ Found ${positionDecreases.length} total position closes!`);
    console.log("═".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
