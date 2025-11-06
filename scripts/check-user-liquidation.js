const { ethers } = require("hardhat");

async function main() {
    // Get wallet address from command line or use default
    const TARGET_USER = process.argv[2] || process.env.USER_ADDRESS;

    if (!TARGET_USER) {
        console.log("Usage: npx hardhat run scripts/check-user-liquidation.js --network arbitrumSepolia <wallet_address>");
        process.exit(1);
    }

    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";

    console.log("=== Checking User Liquidation History ===\n");
    console.log("User:", TARGET_USER);
    console.log();

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    const currentBlock = await ethers.provider.getBlockNumber();

    // Search back 1 million blocks
    const fromBlock = Math.max(0, currentBlock - 1000000);

    console.log("Searching from block", fromBlock, "to", currentBlock);
    console.log("(approximately last 2-3 weeks)\n");

    // Query EventLog2 for all order events
    const filter = eventEmitter.filters.EventLog2();
    console.log("Fetching events...\n");

    const events = await eventEmitter.queryFilter(filter, fromBlock, currentBlock);

    const userEvents = [];

    for (const event of events) {
        const eventName = event.args.eventName;
        const eventData = event.args.eventData;

        if (!eventData.addressItems || !eventData.addressItems.items) continue;

        for (const addr of eventData.addressItems.items) {
            if (addr.key === "account" && addr.value.toLowerCase() === TARGET_USER.toLowerCase()) {

                let orderType = null;
                if (eventData.uintItems && eventData.uintItems.items) {
                    for (const uint of eventData.uintItems.items) {
                        if (uint.key === "orderType") {
                            orderType = uint.value.toString();
                            break;
                        }
                    }
                }

                userEvents.push({
                    event: eventName,
                    block: event.blockNumber,
                    tx: event.transactionHash,
                    orderType: orderType,
                    key: event.args.topic1
                });
                break;
            }
        }
    }

    console.log("=".repeat(80));
    console.log("\n✅ Found", userEvents.length, "order events for user\n");

    if (userEvents.length === 0) {
        console.log("❌ No activity found for this user in the last 1M blocks.");
        return;
    }

    const ORDER_TYPES = ["MarketSwap", "LimitSwap", "MarketIncrease", "LimitIncrease",
                        "MarketDecrease", "LimitDecrease", "StopLossDecrease", "Liquidation", "StopIncrease"];

    let liquidationCount = 0;
    const liquidations = [];

    for (const evt of userEvents) {
        const typeStr = evt.orderType ? ORDER_TYPES[evt.orderType] : "N/A";

        console.log(evt.event + ":");
        console.log("   Block:", evt.block);
        console.log("   Tx:", evt.tx);
        if (evt.orderType) {
            console.log("   OrderType:", typeStr);
        }
        console.log("   Key:", evt.key);

        if (typeStr === "Liquidation") {
            liquidationCount++;
            liquidations.push(evt);
            console.log("   🚨 LIQUIDATION DETECTED!");
        }

        console.log();
    }

    console.log("=".repeat(80));
    console.log("\n📊 SUMMARY:\n");
    console.log("Total Events:", userEvents.length);
    console.log("Liquidations:", liquidationCount);

    if (liquidationCount > 0) {
        console.log("\n💀 LIQUIDATION DETAILS:\n");

        for (let i = 0; i < liquidations.length; i++) {
            const liq = liquidations[i];
            console.log(`${i + 1}. Block ${liq.block}`);
            console.log(`   Tx: ${liq.tx}`);
            console.log(`   View on Arbiscan: https://sepolia.arbiscan.io/tx/${liq.tx}`);
            console.log();
        }

        console.log("✅ User had positions that were liquidated.");
    } else {
        console.log("\n✅ No liquidations found. User positions were closed normally or are still active.");
    }
}

main().catch(console.error);
