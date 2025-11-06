const { ethers } = require("hardhat");

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    
    console.log("=== Checking ALL Liquidations in System ===\n");
    console.log("EventEmitter:", EVENT_EMITTER);
    console.log();

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    const currentBlock = await ethers.provider.getBlockNumber();
    console.log("Current Block:", currentBlock);
    
    // Search last 100,000 blocks
    const fromBlock = Math.max(0, currentBlock - 100000);
    console.log("Searching from block:", fromBlock);
    console.log();
    
    const filter = eventEmitter.filters.EventLog1();
    
    console.log("📋 Fetching events...\n");
    const events = await eventEmitter.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`Found ${events.length} total EventLog1 events\n`);
    console.log("=".repeat(80));
    
    let liquidationCount = 0;
    
    for (const event of events) {
        const eventName = event.args.eventName;
        const eventData = event.args.eventData;
        
        // Check if this is a PositionDecrease event
        if (eventName === "PositionDecrease") {
            // Check the stringItems for liquidation reason
            if (eventData.stringItems && eventData.stringItems.items) {
                for (const item of eventData.stringItems.items) {
                    if (item.key === "reason" && item.value && item.value.toLowerCase().includes("liquidat")) {
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
                        console.log(`   Block: ${event.blockNumber}`);
                        console.log(`   Tx: ${event.transactionHash}`);
                        console.log(`   Account: ${account}`);
                        console.log(`   Reason: ${item.value}`);
                    }
                }
            }
        }
    }
    
    console.log("\n" + "=".repeat(80));
    console.log(`\n📊 SUMMARY: Found ${liquidationCount} liquidations in last ${currentBlock - fromBlock} blocks`);
    
    if (liquidationCount === 0) {
        console.log("\n⚠️  WARNING: No liquidations found! The keeper may not be working properly.");
    }
}

main().catch(console.error);
