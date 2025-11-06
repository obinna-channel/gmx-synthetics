const { ethers } = require("hardhat");

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    
    console.log("=== Checking Event Types ===\n");

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100000);
    
    console.log(`Searching blocks ${fromBlock} to ${currentBlock}\n`);
    
    const filter = eventEmitter.filters.EventLog1();
    const events = await eventEmitter.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`Found ${events.length} total events\n`);
    console.log("=".repeat(80));
    
    // Count event types
    const eventTypes = {};
    
    for (const event of events) {
        const eventName = event.args.eventName;
        if (!eventTypes[eventName]) {
            eventTypes[eventName] = 0;
        }
        eventTypes[eventName]++;
    }
    
    console.log("\n📊 Event Types Found:\n");
    for (const [name, count] of Object.entries(eventTypes).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${name}: ${count}`);
    }
    
    // Now specifically look for any event with "liquidat" in the name
    console.log("\n" + "=".repeat(80));
    console.log("\n🔍 Looking for liquidation-related events...\n");
    
    for (const event of events) {
        const eventName = event.args.eventName;
        if (eventName.toLowerCase().includes("liquidat")) {
            console.log(`   Found: ${eventName} at block ${event.blockNumber}`);
            console.log(`   Tx: ${event.transactionHash}`);
            
            // Show the event data structure
            const eventData = event.args.eventData;
            if (eventData.addressItems && eventData.addressItems.items) {
                for (const addr of eventData.addressItems.items) {
                    if (addr.key === "account") {
                        console.log(`   Account: ${addr.value}`);
                    }
                }
            }
            console.log();
        }
    }
}

main().catch(console.error);
