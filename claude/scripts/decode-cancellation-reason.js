const { ethers } = require("hardhat");

async function main() {
    console.log("=== Decoding Deposit Cancellation Reason ===\n");
    
    const txHash = "0x90678882efe64512122b0571d10561f698d058fa6f242ff2d0db1062080f9456";
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    // EventEmitter address
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    
    // Filter for EventEmitter logs
    const eventEmitterLogs = receipt.logs.filter(
        log => log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()
    );
    
    console.log("Found", eventEmitterLogs.length, "EventEmitter logs\n");
    
    // Parse EventLog1 and EventLog2 events
    const eventLog1Interface = new ethers.utils.Interface([
        "event EventLog1(address msgSender, string eventName, string indexed eventNameHash, bytes32 indexed topic1, bytes eventData)"
    ]);
    
    const eventLog2Interface = new ethers.utils.Interface([
        "event EventLog2(address msgSender, string eventName, string indexed eventNameHash, bytes32 indexed topic1, bytes32 indexed topic2, bytes eventData)"
    ]);
    
    for (let i = 0; i < eventEmitterLogs.length; i++) {
        const log = eventEmitterLogs[i];
        console.log(`\n📝 Event ${i + 1}:`);
        
        try {
            // Try EventLog2 first (has more topics)
            if (log.topics.length === 4) {
                const parsed = eventLog2Interface.parseLog(log);
                console.log("  Type: EventLog2");
                console.log("  Event Name:", parsed.args.eventName);
                console.log("  Msg Sender:", parsed.args.msgSender);
                
                // Check for specific event types
                if (parsed.args.eventName === "DepositCancelled") {
                    console.log("\n  ❌ DEPOSIT WAS CANCELLED!");
                    
                    // Decode the event data to get the reason
                    const eventDataHex = parsed.args.eventData;
                    console.log("  Raw event data length:", eventDataHex.length, "chars");
                    
                    // Try to decode the reason from event data
                    // The data should contain the deposit details and cancellation reason
                    if (eventDataHex.length > 2) {
                        // Look for string patterns in the data
                        const dataStr = eventDataHex.toString();
                        console.log("\n  Analyzing cancellation data...");
                        
                        // Common cancellation reasons in GMX
                        const reasons = [
                            "MinMarketTokens",
                            "InsufficientPoolValue", 
                            "EmptyDepositAmounts",
                            "InsufficientWntAmount",
                            "DisabledFeature",
                            "MaxSwapPathLength",
                            "InsufficientReserve"
                        ];
                        
                        // Check if any reason appears in the data
                        for (const reason of reasons) {
                            const reasonHex = ethers.utils.hexlify(ethers.utils.toUtf8Bytes(reason));
                            if (dataStr.includes(reasonHex.slice(2))) {
                                console.log("  🎯 Found cancellation reason:", reason);
                            }
                        }
                    }
                } else if (parsed.args.eventName === "DepositExecuted") {
                    console.log("  ✅ DEPOSIT EXECUTED!");
                } else if (parsed.args.eventName === "DepositCreated") {
                    console.log("  📄 DEPOSIT CREATED");
                }
            } else if (log.topics.length === 3) {
                const parsed = eventLog1Interface.parseLog(log);
                console.log("  Type: EventLog1");
                console.log("  Event Name:", parsed.args.eventName);
                console.log("  Msg Sender:", parsed.args.msgSender);
            }
        } catch (e) {
            console.log("  Could not parse as EventLog1/2");
            console.log("  Topics:", log.topics.length);
            console.log("  Data length:", log.data.length);
        }
    }
    
    // Also check for any revert reasons in the transaction
    console.log("\n🔍 Checking for error patterns in event data...");
    
    // Get the full transaction trace if possible
    try {
        const tx = await ethers.provider.getTransaction(txHash);
        console.log("\nTransaction input data length:", tx.data.length);
        
        // Check if transaction succeeded but deposit was cancelled
        if (receipt.status === 1) {
            console.log("\n⚠️  Transaction succeeded but deposit may have been cancelled internally");
            console.log("This usually means a validation check failed during execution.");
        }
    } catch (e) {
        console.log("Could not get transaction details:", e.message);
    }
}

main().catch(console.error);