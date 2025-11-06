const { ethers } = require("hardhat");

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const TARGET_USER = "0xfE6a58323acFd101981CB00530Fb8089B137115F";
    
    console.log("=== Checking Past Liquidations ===\n");
    console.log("EventEmitter:", EVENT_EMITTER);
    console.log("Target User:", TARGET_USER);
    console.log();

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    // Get current block
    const currentBlock = await ethers.provider.getBlockNumber();
    console.log("Current Block:", currentBlock);
    
    // Search last 10000 blocks (adjust as needed)
    const fromBlock = Math.max(0, currentBlock - 50000);
    console.log("Searching from block:", fromBlock);
    console.log();
    
    // Query for EventLog1 events (PositionDecrease uses EventLog1)
    const filter = eventEmitter.filters.EventLog1();
    
    console.log("📋 Fetching events...\n");
    const events = await eventEmitter.queryFilter(filter, fromBlock, currentBlock);
    
    console.log(`Found ${events.length} total events\n`);
    console.log("=".repeat(80));
    
    // Filter for PositionDecrease events involving the target user
    const userEvents = events.filter(event => {
        const eventName = event.args.eventName;
        const topic1 = event.args.topic1;
        
        // topic1 is the position key for position events
        return eventName === "PositionDecrease" || eventName === "PositionIncrease";
    });
    
    console.log(`\n📊 Found ${userEvents.length} Position events\n`);
    
    // Display all position events to see if our user appears
    for (const event of userEvents.slice(0, 20)) {  // Show first 20
        const eventData = event.args.eventData;
        const addresses = eventData.addressItems.items;
        
        // Find account address
        let account = null;
        for (const addr of addresses) {
            if (addr.key === "account") {
                account = addr.value;
                break;
            }
        }
        
        if (account && account.toLowerCase() === TARGET_USER.toLowerCase()) {
            console.log("🔍 FOUND USER EVENT!");
            console.log("   Event:", event.args.eventName);
            console.log("   Block:", event.blockNumber);
            console.log("   Tx:", event.transactionHash);
            console.log("   Account:", account);
            console.log();
        }
    }
    
    console.log("\n=".repeat(80));
    console.log("\n💡 Checking ALL position events for user", TARGET_USER);
    
    // More comprehensive search
    let foundEvents = 0;
    for (const event of events) {
        const eventName = event.args.eventName;
        const eventData = event.args.eventData;
        
        if (!eventData.addressItems) continue;
        
        const addresses = eventData.addressItems.items;
        if (!addresses) continue;
        
        // Find account address
        let account = null;
        for (const addr of addresses) {
            if (addr.key === "account") {
                account = addr.value;
                break;
            }
        }
        
        if (account && account.toLowerCase() === TARGET_USER.toLowerCase()) {
            foundEvents++;
            console.log(`\n${foundEvents}. Event: ${eventName}`);
            console.log(`   Block: ${event.blockNumber}`);
            console.log(`   Tx: ${event.transactionHash}`);
            
            // Check for liquidation-specific fields
            if (eventData.stringItems && eventData.stringItems.items) {
                for (const item of eventData.stringItems.items) {
                    console.log(`   ${item.key}: ${item.value}`);
                }
            }
        }
    }
    
    console.log(`\n✅ Total events for user: ${foundEvents}`);
}

main().catch(console.error);
