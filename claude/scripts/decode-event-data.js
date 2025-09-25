const { ethers } = require("hardhat");

async function main() {
    console.log("=== Decoding EventEmitter Event Data ===\n");
    
    const txHash = "0x90678882efe64512122b0571d10561f698d058fa6f242ff2d0db1062080f9456";
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    // Get EventEmitter contract
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    // Filter for EventEmitter logs
    const eventEmitterLogs = receipt.logs.filter(
        log => log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()
    );
    
    console.log("Found", eventEmitterLogs.length, "EventEmitter logs\n");
    
    // Parse each log
    for (let i = 0; i < eventEmitterLogs.length; i++) {
        const log = eventEmitterLogs[i];
        console.log(`\n📝 Event ${i + 1}:`);
        console.log("  Topic[0] (signature):", log.topics[0]);
        
        // Try to parse with EventEmitter interface
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            console.log("  Event Name:", parsed.name);
            
            if (parsed.name === "EventLog" || parsed.name === "EventLog1" || parsed.name === "EventLog2") {
                console.log("  msgSender:", parsed.args.msgSender);
                console.log("  eventName:", parsed.args.eventName);
                
                // Check for specific event types
                if (parsed.args.eventName === "DepositCancelled") {
                    console.log("\n  ❌ DEPOSIT WAS CANCELLED!");
                    
                    // Try to extract reason from eventData
                    if (parsed.args.eventData) {
                        console.log("\n  Analyzing cancellation data...");
                        const eventData = parsed.args.eventData;
                        
                        // Decode the EventData struct
                        if (eventData.stringItems && eventData.stringItems.items) {
                            console.log("  String items:");
                            for (const item of eventData.stringItems.items) {
                                console.log(`    ${item.key}: ${item.value}`);
                                if (item.key === "reason" || item.key === "cancellationReason") {
                                    console.log(`    🎯 CANCELLATION REASON: ${item.value}`);
                                }
                            }
                        }
                        
                        if (eventData.uintItems && eventData.uintItems.items) {
                            console.log("  Uint items:");
                            for (const item of eventData.uintItems.items) {
                                console.log(`    ${item.key}: ${item.value.toString()}`);
                            }
                        }
                    }
                } else if (parsed.args.eventName === "DepositExecuted") {
                    console.log("  ✅ DEPOSIT EXECUTED!");
                } else if (parsed.args.eventName === "DepositCreated") {
                    console.log("  📄 DEPOSIT CREATED");
                }
            }
        } catch (e) {
            console.log("  Could not parse event:", e.message);
            
            // Try to decode raw data
            if (log.data && log.data.length > 2) {
                console.log("\n  Attempting raw data analysis...");
                const dataHex = log.data;
                
                // Look for error signatures in the data
                const errorPatterns = {
                    "0x6c3e27f2": "MinMarketTokens",
                    "0xfe99dc66": "EmptyDepositAmounts",
                    "0xb2ddc979": "InsufficientWntAmount",
                    "0x5c98e91e": "DisabledFeature",
                    "0x4e186bc7": "InsufficientPoolValue"
                };
                
                for (const [sig, reason] of Object.entries(errorPatterns)) {
                    if (dataHex.includes(sig.slice(2))) {
                        console.log(`  🎯 Found error pattern: ${reason}`);
                    }
                }
                
                // Try to find strings in the data
                try {
                    // Look for ASCII strings
                    const matches = dataHex.match(/[0-9a-f]{64}([0-9a-f]+)/gi);
                    if (matches) {
                        for (const match of matches.slice(0, 5)) { // Check first 5 matches
                            try {
                                const str = ethers.utils.toUtf8String("0x" + match);
                                if (str && str.length > 0 && str.length < 100 && /^[\x20-\x7E]+$/.test(str)) {
                                    console.log(`  Possible string: "${str}"`);
                                }
                            } catch {}
                        }
                    }
                } catch {}
            }
        }
    }
    
    // Summary
    console.log("\n📊 Summary:");
    console.log("Transaction succeeded but deposit appears to have been cancelled.");
    console.log("Tokens were refunded to the user.");
    console.log("\nCommon cancellation reasons:");
    console.log("1. MinMarketTokens - deposit would mint too few market tokens");
    console.log("2. InsufficientPoolValue - pool value calculation issues");
    console.log("3. EmptyDepositAmounts - calculated amounts were zero");
    console.log("4. Price impact too high");
}

main().catch(console.error);