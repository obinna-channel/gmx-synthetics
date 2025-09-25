const { ethers } = require("hardhat");

async function main() {
    console.log("=== Analyzing Deposit Cancellation ===\n");

    const txHash = "0x5b98ed6e316ea4885e3b96d5071492aeef135ab3fd50959a5ed88c08ab20e70c";
    const receipt = await ethers.provider.getTransactionReceipt(txHash);

    // Get the EventLog2 event (second event)
    const eventLog = receipt.logs[1];

    console.log("EventLog2 Details:");
    console.log("  Contract:", eventLog.address);
    console.log("  Topics:");
    console.log("    [0] Event Signature:", eventLog.topics[0]);
    console.log("    [1] Message Sender:", eventLog.topics[1]);
    console.log("    [2] Event Name Hash:", eventLog.topics[2]);
    console.log("    [3] Key/Account:", eventLog.topics[3]);

    // Decode the message sender
    const msgSender = ethers.utils.getAddress("0x" + eventLog.topics[1].slice(26));
    console.log("\n  Decoded Message Sender:", msgSender);

    // Check what event this is
    const possibleEvents = [
        "DepositCreated",
        "DepositExecuted",
        "DepositCancelled",
        "CancelDeposit",
        "ExecuteDeposit",
        "EmptyDeposit",
        "EmptyDepositAmountsAfterSwap",
        "InvalidPoolValueForDeposit"
    ];

    console.log("\n  Checking event type:");
    for (const eventName of possibleEvents) {
        const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(eventName));
        if (hash === eventLog.topics[2]) {
            console.log("    🎯 Event Type:", eventName);
        }
    }

    // The key in topics[3] might be the deposit key or account
    const keyOrAccount = ethers.utils.getAddress("0x" + eventLog.topics[3].slice(26));
    console.log("\n  Key/Account from topics[3]:", keyOrAccount);

    // Decode the event data
    console.log("\n📝 Event Data Analysis:");
    const eventData = eventLog.data;

    // The data contains structured information
    // Let's try to extract the reason string if it exists

    try {
        // Skip the first part of data (it's the encoded structure)
        // Look for string data which often contains the cancellation reason

        // Convert hex to string to look for readable text
        const dataStr = eventData.substring(2); // Remove 0x
        const chunks = dataStr.match(/.{1,64}/g) || [];

        console.log("\n  Looking for cancellation reason in data...");

        // Search for common error messages in the data
        const possibleReasons = [
            "EmptyDeposit",
            "EmptyPrimaryPrice",
            "InvalidPoolValue",
            "InsufficientLiquidity",
            "OracleTimestamps",
            "EmptyDepositAmounts"
        ];

        // Try to find ASCII text in the data
        for (let i = 0; i < chunks.length; i++) {
            try {
                const bytes = ethers.utils.arrayify("0x" + chunks[i]);
                const text = ethers.utils.toUtf8String(bytes);
                if (text && text.length > 2 && /^[\x20-\x7E]+$/.test(text)) {
                    console.log(`    Chunk ${i}: "${text}"`);
                }
            } catch (e) {
                // Not valid UTF-8, skip
            }
        }

    } catch (error) {
        console.log("  Could not decode reason from data");
    }

    // Check the execution flow
    console.log("\n\n🔍 EXECUTION FLOW ANALYSIS:");

    console.log("\n1. What we know:");
    console.log("   - executeDeposit was called by DepositHandler");
    console.log("   - Transaction succeeded (no revert)");
    console.log("   - USDT was refunded to your account");
    console.log("   - No market tokens were minted");

    console.log("\n2. Possible cancellation reasons:");
    console.log("   - EmptyDeposit: Deposit data was invalid or missing");
    console.log("   - EmptyPrimaryPrice: Oracle prices not available for required tokens");
    console.log("   - Invalid pool value: Pool value calculation failed");
    console.log("   - Slippage: minMarketTokens requirement not met");

    // Check if it was an automatic cancellation due to error handling
    console.log("\n3. Error Handling Path:");
    console.log("   The DepositHandler has a try-catch that cancels deposits on error");
    console.log("   This prevents loss of funds by refunding on any execution failure");

    // Look for the specific handler
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    if (msgSender.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
        console.log("\n   ✅ Cancellation initiated by DepositHandler");
        console.log("   This indicates an execution error was caught and handled");
    }

    // Check what the actual deposit parameters were
    console.log("\n\n📊 DEPOSIT PARAMETERS CHECK:");
    console.log("   Deposit Key:", "0x3772b0c5ec95382c48668749a697d7586df957e3d46b97658950d33d9daa5910");
    console.log("   Expected:");
    console.log("     - Receiver: address(1) for first deposit");
    console.log("     - Long Token Amount: 100 USDT");
    console.log("     - Short Token Amount: 0 USDT");
    console.log("     - Market: USDTNGN");

    console.log("\n\n💡 MOST LIKELY CAUSE:");
    console.log("   The deposit was cancelled during execution due to:");
    console.log("   1. Empty primary price for one of the tokens");
    console.log("   2. Pool value calculation issues (first deposit special handling)");
    console.log("   3. The receiver being address(1) might have caused validation issues");
}

main().catch(console.error);