const { ethers } = require("hardhat");

async function main() {
    const TARGET_USER = "0xfE6a58323acFd101981CB00530Fb8089B137115F";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const START_BLOCK = 206770529; // The block where they created the order

    console.log("=== Tracking User Order from Block", START_BLOCK, "===\n");
    console.log("User:", TARGET_USER);
    console.log();

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    const currentBlock = await ethers.provider.getBlockNumber();

    console.log("Searching from block", START_BLOCK, "to", currentBlock);
    console.log("That's", currentBlock - START_BLOCK, "blocks\n");

    // Query EventLog2 for all order events
    const filter = eventEmitter.filters.EventLog2();
    console.log("Fetching events...\n");

    const events = await eventEmitter.queryFilter(filter, START_BLOCK, currentBlock);

    console.log("Found", events.length, "total EventLog2 events\n");
    console.log("=".repeat(80));

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

    console.log("\n✅ Found", userEvents.length, "events for user:\n");

    const ORDER_TYPES = ["MarketSwap", "LimitSwap", "MarketIncrease", "LimitIncrease",
                        "MarketDecrease", "LimitDecrease", "StopLossDecrease", "Liquidation", "StopIncrease"];

    for (const evt of userEvents) {
        console.log(evt.event + ":");
        console.log("   Block:", evt.block);
        console.log("   Tx:", evt.tx);
        if (evt.orderType) {
            console.log("   OrderType:", ORDER_TYPES[evt.orderType]);
        }
        console.log("   Key:", evt.key);
        console.log();
    }
}

main().catch(console.error);
