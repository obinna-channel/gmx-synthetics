const { ethers } = require("hardhat");

async function main() {
    console.log("=== Decoding EventEmitter Events ===\n");
    
    const txHash = "0x90678882efe64512122b0571d10561f698d058fa6f242ff2d0db1062080f9456";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    // Filter for EventEmitter logs
    const eventEmitterLogs = receipt.logs.filter(
        log => log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()
    );
    
    console.log("Found", eventEmitterLogs.length, "EventEmitter events\n");
    
    // Known EventEmitter event signatures
    const eventSignatures = {
        "0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160": "EventLog1",
        "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5": "EventLog2",
    };
    
    for (let i = 0; i < eventEmitterLogs.length; i++) {
        const log = eventEmitterLogs[i];
        console.log(`\nEvent ${i + 1}:`);
        console.log("  Signature:", log.topics[0]);
        
        const eventType = eventSignatures[log.topics[0]] || "Unknown EventLog";
        console.log("  Type:", eventType);
        
        if (log.topics[1]) {
            console.log("  Topic 1 (msgSender):", log.topics[1]);
            console.log("  Topic 2 (eventName hash):", log.topics[2]);
            
            // Try to decode the event name
            const eventNameTopics = {
                "0x69326d429c7cfff04c8e7c0f9c960bb52ff088fa19b42bc87eac959f95e59f40": "DepositCreated",
                "0x7b8ad5b41628c239370e63f8658ac405e9bebe9b8fb814dcaf6fb647e05c867f": "DepositExecuted", 
                "0x4e186bc75a2220191b826baff3ee63c3e970e94e8a3b0dd3b862e0e6d44d4018": "DepositCancelled",
                "0xb82118279c78709f5cf5fb59e0fbc087b0c4a60be1f81bfa99709e86e2091e83": "ExecutionFailed",
                "0xb2ddc9797c8c604a088ac3cf8e93c43e960fd604e0e70e674f6c3e9bc26be8ad": "InsufficientWntAmount",
                "0xfe99dc66c0771ad652e5e4f89e417b8f2c3d95ae88c6a0e5de18a40a8f184c08": "EmptyDepositAmounts",
                "0x6c3e27f2fcb93e87ae3a17e31e52e103e9fc1afdcf3e4e39c2f3f3a6d93f407f": "MinMarketTokens"
            };
            
            const eventName = eventNameTopics[log.topics[2]];
            if (eventName) {
                console.log("  🎯 EVENT NAME:", eventName);
                
                if (eventName === "DepositCancelled") {
                    console.log("  ❌ DEPOSIT WAS CANCELLED!");
                } else if (eventName === "DepositExecuted") {
                    console.log("  ✅ DEPOSIT WAS EXECUTED!");
                }
            }
        }
        
        // Log data preview
        console.log("  Data length:", log.data.length, "bytes");
        if (log.data.length > 2) {
            console.log("  Data preview:", log.data.substring(0, 66), "...");
        }
    }
    
    console.log("\n💡 Note: EventEmitter logs the actual execution events.");
    console.log("If DepositCancelled was emitted, check the data for error reasons.");
}

main().catch(console.error);