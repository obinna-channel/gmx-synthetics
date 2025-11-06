const { ethers } = require("hardhat");

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const TARGET_ACCOUNT = "0x570CD8a1dfF5EACc2B322EC9E6825132B97f30C3";
    
    console.log("=== Checking Liquidation Order Details ===\n");
    console.log("Target Account:", TARGET_ACCOUNT);
    console.log();

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100000);
    
    const filter = eventEmitter.filters.EventLog2();
    const events = await eventEmitter.queryFilter(filter, fromBlock, currentBlock);
    
    const accountOrders = [];
    
    for (const event of events) {
        const eventName = event.args.eventName;
        if (eventName !== "OrderCreated" && eventName !== "OrderExecuted" && eventName !== "OrderCancelled") {
            continue;
        }
        
        const eventData = event.args.eventData;
        
        let account = null;
        if (eventData.addressItems && eventData.addressItems.items) {
            for (const addr of eventData.addressItems.items) {
                if (addr.key === "account") {
                    account = addr.value;
                    break;
                }
            }
        }
        
        if (account && account.toLowerCase() === TARGET_ACCOUNT.toLowerCase()) {
            let orderType = null;
            if (eventData.uintItems && eventData.uintItems.items) {
                for (const uint of eventData.uintItems.items) {
                    if (uint.key === "orderType") {
                        orderType = uint.value.toString();
                        break;
                    }
                }
            }
            
            accountOrders.push({
                event: eventName,
                block: event.blockNumber,
                tx: event.transactionHash,
                orderType: orderType,
                key: event.args.topic1
            });
        }
    }
    
    console.log("Found " + accountOrders.length + " order events for account " + TARGET_ACCOUNT + "\n");
    console.log("=".repeat(80));
    
    const ORDER_TYPES = ["MarketSwap", "LimitSwap", "MarketIncrease", "LimitIncrease", 
                        "MarketDecrease", "LimitDecrease", "StopLossDecrease", "Liquidation", "StopIncrease"];
    
    for (const order of accountOrders) {
        console.log("\n" + order.event + ":");
        console.log("   Block: " + order.block);
        console.log("   Tx: " + order.tx);
        console.log("   OrderType: " + ORDER_TYPES[order.orderType]);
        console.log("   Key: " + order.key);
    }
}

main().catch(console.error);
