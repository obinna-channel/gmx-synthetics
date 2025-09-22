const { ethers } = require("hardhat");

async function main() {
    console.log("=== Deep Diagnosis of Error 0x95b66fe9 ===\n");
    
    const [signer] = await ethers.getSigners();
    
    // We'll analyze the last transaction that got cancelled
    const lastTxHash = "0xd1f33aa8475455831395556cb5ec134933b4303749409424ef68329beb1c9322";
    console.log("Analyzing transaction:", lastTxHash);
    console.log("This tx used 1.4M gas and got cancelled with 0x95b66fe9\n");
    
    // Get the transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(lastTxHash);
    
    console.log("Transaction details:");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas used:", receipt.gasUsed.toString());
    console.log("  Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("  Logs:", receipt.logs.length, "events\n");
    
    // Analyze the events
    const EVENT_EMITTER = "0x9f7a35862df4513e59d63cceac1eb15e0f887ad2";
    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    
    console.log("Events in order:");
    let cancelEvent = null;
    let eventSequence = [];
    
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            eventSequence.push(parsed.name);
            
            // Show key events
            if (parsed.name === "DepositCancelled") {
                cancelEvent = parsed;
                console.log(`\n[${i}] ⚠️ ${parsed.name}`);
                console.log("    Key:", parsed.args.key);
                if (parsed.args.reason) {
                    console.log("    Reason:", parsed.args.reason);
                }
                if (parsed.args.reasonBytes) {
                    console.log("    ReasonBytes:", parsed.args.reasonBytes);
                    // Try to decode the bytes
                    if (parsed.args.reasonBytes !== "0x") {
                        console.log("    Decoded:", ethers.utils.toUtf8String(parsed.args.reasonBytes).replace(/[^\x20-\x7E]/g, ''));
                    }
                }
            } else if (["OraclePrice", "MarketPoolValueUpdated", "PositionImpactPoolAmountUpdated", "SwapInfo"].includes(parsed.name)) {
                console.log(`[${i}] ${parsed.name}`);
            }
        } catch (e) {
            // Not an EventEmitter event
        }
    }
    
    console.log("\n=== ERROR ANALYSIS ===");
    
    if (cancelEvent) {
        console.log("\nDeposit was cancelled internally");
        console.log("The error 0x95b66fe9 caused the cancellation");
        
        // Let's check what happened right before the cancellation
        const cancelIndex = eventSequence.indexOf("DepositCancelled");
        if (cancelIndex > 0) {
            console.log("\nEvents leading up to cancellation:");
            for (let i = Math.max(0, cancelIndex - 5); i < cancelIndex; i++) {
                console.log("  ", eventSequence[i]);
            }
            console.log("  ❌", eventSequence[cancelIndex]);
        }
    }
    
    // Try to trace the error source
    console.log("\n=== HYPOTHESIS ===");
    console.log("\nBased on the 1.4M gas usage, the execution went deep into:");
    console.log("1. Oracle price validation ✅");
    console.log("2. Market pool value calculation ✅");
    console.log("3. Position impact calculation ✅");
    console.log("4. Swap execution (if needed) ✅");
    console.log("5. Market token minting ❌ LIKELY FAILURE POINT");
    console.log("\nThe error 0x95b66fe9 is likely from:");
    console.log("- Market token minting logic");
    console.log("- A callback or hook in the market token");
    console.log("- Pool value validation after minting");
    
    // Check market token implementation
    console.log("\n=== MARKET TOKEN CHECK ===");
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const marketCode = await ethers.provider.getCode(MARKET);
    
    // Look for the error selector in the market token
    if (marketCode.includes("95b66fe9")) {
        console.log("⚠️ ERROR FOUND IN MARKET TOKEN CONTRACT!");
    } else {
        console.log("Error not in market token bytecode");
        console.log("Market token code size:", marketCode.length);
        
        // Check if it's a proxy
        if (marketCode.length < 200) {
            console.log("Market token appears to be a proxy (small bytecode)");
        }
    }
    
    // Let's check if the market token has special requirements
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    try {
        const totalSupply = await marketToken.totalSupply();
        console.log("\nMarket token supply:", ethers.utils.formatEther(totalSupply));
        
        if (totalSupply.eq(0)) {
            console.log("💡 This would be the FIRST mint - special validation may apply");
        }
    } catch (e) {
        console.log("Error reading market token:", e.message);
    }
}

main().catch(console.error);