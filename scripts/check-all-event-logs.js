const { ethers } = require("hardhat");

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    
    console.log("=== Checking ALL Event Types (EventLog, EventLog1, EventLog2) ===\n");

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100000);
    
    console.log(`Searching blocks ${fromBlock} to ${currentBlock}\n`);
    
    // Check all three event types
    const filters = [
        { name: "EventLog", filter: eventEmitter.filters.EventLog() },
        { name: "EventLog1", filter: eventEmitter.filters.EventLog1() },
        { name: "EventLog2", filter: eventEmitter.filters.EventLog2() }
    ];
    
    for (const { name, filter } of filters) {
        console.log(`\n📋 Checking ${name}...`);
        const events = await eventEmitter.queryFilter(filter, fromBlock, currentBlock);
        console.log(`   Found ${events.length} events`);
        
        const eventTypes = {};
        for (const event of events) {
            const eventName = event.args.eventName;
            if (!eventTypes[eventName]) {
                eventTypes[eventName] = 0;
            }
            eventTypes[eventName]++;
        }
        
        // Show all unique event names
        const sortedEvents = Object.entries(eventTypes).sort((a, b) => b[1] - a[1]);
        for (const [evtName, count] of sortedEvents) {
            console.log(`      ${evtName}: ${count}`);
        }
    }
}

main().catch(console.error);
