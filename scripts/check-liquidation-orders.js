const { ethers } = require("hardhat");

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    
    console.log("=== Checking for Liquidation Orders ===\n");

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100000);
    
    console.log(`Searching blocks ${fromBlock} to ${currentBlock}\n`);
    
    // Query EventLog2 for OrderCreated and OrderExecuted
    const filter = eventEmitter.filters.EventLog2();
    const events = await eventEmitter.queryFilter(filter, fromBlock, currentBlock);
    
    const orderEvents = events.filter(e => 
        e.args.eventName === "OrderExecuted" || 
        e.args.eventName === "OrderCreated"
    );
    
    console.log(`Found ${orderEvents.length} order events\n`);
    console.log("=".repeat(80));
    
    let liquidationCount = 0;
    
    for (const event of orderEvents) {
        const eventData = event.args.eventData;
        
        // Find orderType in uintItems
        if (eventData.uintItems && eventData.uintItems.items) {
            for (const uint of eventData.uintItems.items) {
                // OrderType.Liquidation = 7
                if (uint.key === "orderType" && uint.value.toString() === "7") {
                    liquidationCount++;
                    
                    // Get account from addressItems
                    let account = null;
                    if (eventData.addressItems && eventData.addressItems.items) {
                        for (const addr of eventData.addressItems.items) {
                            if (addr.key === "account") {
                                account = addr.value;
                                break;
                            }
                        }
                    }
                    
                    console.log(`\n💀 LIQUIDATION #${liquidationCount}`);
                    console.log(`   Event: ${event.args.eventName}`);
                    console.log(`   Block: ${event.blockNumber}`);
                    console.log(`   Tx: ${event.transactionHash}`);
                    console.log(`   Account: ${account}`);
                    console.log();
                }
            }
        }
    }
    
    console.log("=".repeat(80));
    console.log(`\n📊 SUMMARY: Found ${liquidationCount} liquidation orders in last ${currentBlock - fromBlock} blocks\n`);
    
    if (liquidationCount === 0) {
        console.log("⚠️  WARNING: No liquidations found! The keeper may not be working properly.\n");
    }
}

main().catch(console.error);
