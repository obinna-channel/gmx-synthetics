const { ethers } = require("hardhat");

/**
 * Simple script to read recent events from EventEmitter
 * Just to see what's actually being emitted
 */

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const LOOKBACK_BLOCKS = 10000;

    console.log("\n=== Reading Recent Events from EventEmitter ===\n");

    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - LOOKBACK_BLOCKS;

    console.log(`Current Block: ${currentBlock}`);
    console.log(`Searching from: ${fromBlock}`);
    console.log(`EventEmitter: ${EVENT_EMITTER}\n`);

    // Get ALL logs from the EventEmitter address
    console.log("Fetching all logs from EventEmitter...");

    const allLogs = await ethers.provider.getLogs({
        address: EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock
    });

    console.log(`✅ Found ${allLogs.length} total logs\n`);

    if (allLogs.length === 0) {
        console.log("No logs found!");
        return;
    }

    // Get the EventEmitter contract to decode
    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    // Group by event signature
    const eventSignatures = {};
    let decoded = 0;
    let failed = 0;

    console.log("Analyzing events...\n");

    for (const log of allLogs) {
        const sig = log.topics[0];

        if (!eventSignatures[sig]) {
            eventSignatures[sig] = {
                count: 0,
                signature: sig,
                examples: [],
                name: null
            };
        }

        eventSignatures[sig].count++;

        // Try to decode
        if (eventSignatures[sig].examples.length < 3) {
            try {
                const parsed = eventEmitter.interface.parseLog(log);
                eventSignatures[sig].name = parsed.name;

                if (parsed.name === "EventLog1") {
                    eventSignatures[sig].examples.push({
                        blockNumber: log.blockNumber,
                        txHash: log.transactionHash,
                        eventName: parsed.args.eventName,
                        topic1: parsed.args.topic1
                    });
                }
                decoded++;
            } catch (e) {
                failed++;
            }
        }
    }

    // Display summary
    console.log("Event Summary:");
    console.log("─".repeat(70));

    for (const [sig, data] of Object.entries(eventSignatures)) {
        console.log(`\n${data.name || 'Unknown'} (${sig.slice(0, 10)}...)`);
        console.log(`  Count: ${data.count}`);

        if (data.examples.length > 0) {
            console.log(`  Recent examples:`);
            data.examples.forEach((ex, i) => {
                console.log(`    ${i + 1}. Block ${ex.blockNumber}: ${ex.eventName}`);
                console.log(`       Tx: ${ex.txHash}`);
                console.log(`       Topic1: ${ex.topic1}`);
            });
        }
    }

    console.log("\n\n" + "=".repeat(70));
    console.log(`Total: ${allLogs.length} logs`);
    console.log(`Decoded: ${decoded}`);
    console.log(`Failed to decode: ${failed}`);
    console.log("=".repeat(70) + "\n");

    // Show most recent 5 EventLog1 events with details
    console.log("\n=== Most Recent EventLog1 Events ===\n");

    const eventLog1s = [];
    for (const log of allLogs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            if (parsed.name === "EventLog1") {
                eventLog1s.push({
                    blockNumber: log.blockNumber,
                    txHash: log.transactionHash,
                    eventName: parsed.args.eventName,
                    topic1: parsed.args.topic1,
                    eventData: parsed.args.eventData
                });
            }
        } catch (e) {}
    }

    // Sort by block number (most recent first)
    eventLog1s.sort((a, b) => b.blockNumber - a.blockNumber);

    const recentEvents = eventLog1s.slice(0, 10);

    for (let i = 0; i < recentEvents.length; i++) {
        const event = recentEvents[i];
        console.log(`${i + 1}. Block ${event.blockNumber} - ${event.eventName}`);
        console.log(`   Tx: ${event.txHash}`);
        console.log(`   Topic1: ${event.topic1}`);

        // If it has address items, show the first one (usually the account)
        if (event.eventData.addressItems && event.eventData.addressItems.items.length > 0) {
            console.log(`   Account: ${event.eventData.addressItems.items[0].value}`);
        }
        console.log();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
