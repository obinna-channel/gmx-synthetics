const { ethers } = require("hardhat");

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const TARGET_USER = "0xfE6a58323acFd101981CB00530Fb8089B137115F";
    
    console.log("=== Searching for User Activity ===\n");
    console.log("Target User:", TARGET_USER);
    console.log();

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    const currentBlock = await ethers.provider.getBlockNumber();
    
    // Search last 500,000 blocks (much larger range)
    const fromBlock = Math.max(0, currentBlock - 500000);
    
    console.log(`Searching blocks ${fromBlock} to ${currentBlock}`);
    console.log("(This is approximately the last ~1-2 weeks on Arbitrum)\n");
    
    // Check EventLog2 for OrderCreated/OrderExecuted
    const filter2 = eventEmitter.filters.EventLog2();
    console.log("Fetching EventLog2 events...");
    const events2 = await eventEmitter.queryFilter(filter2, fromBlock, currentBlock);
    
    console.log(`Found ${events2.length} EventLog2 events\n`);
    
    let foundOrders = 0;
    for (const event of events2) {
        const eventData = event.args.eventData;
        
        if (!eventData.addressItems || !eventData.addressItems.items) continue;
        
        for (const addr of eventData.addressItems.items) {
            if (addr.key === "account" && addr.value.toLowerCase() === TARGET_USER.toLowerCase()) {
                foundOrders++;
                console.log(`Found ${event.args.eventName} at block ${event.blockNumber}`);
                console.log(`   Tx: ${event.transactionHash}`);
                break;
            }
        }
    }
    
    console.log(`\n✅ Total order events for user: ${foundOrders}\n`);
    
    if (foundOrders === 0) {
        console.log("❌ No activity found for this user in the last 500,000 blocks.");
        console.log("   The user may have never created a position on this deployment.");
    }
}

main().catch(console.error);
