const { ethers } = require("hardhat");

async function main() {
    // Transaction hash from the cancelled order
    const TX_HASH = process.argv[2] || "0x75e1b986039e38a2aa06739209330ec622b36c96c8b1374835a7cb5f8fdec061";

    console.log("=== Analyzing Cancelled Order Transaction ===\n");
    console.log("TX Hash:", TX_HASH);

    // Get the transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
        console.log("❌ Transaction not found");
        return;
    }

    console.log("\n📊 Transaction Info:");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Status:", receipt.status ? "Success (1)" : "Failed (0)");
    console.log("  Gas Used:", receipt.gasUsed.toString());

    // Contract addresses
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    // Event signatures
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
    const ORDER_CANCELLED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCancelled"));
    const ORDER_EXECUTED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderExecuted"));

    console.log("\n📋 Events in Transaction:");

    let orderKey = null;
    let cancellationReason = null;
    let cancellationReasonBytes = null;

    for (const log of receipt.logs) {
        // Check for OrderCancelled event
        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase() &&
            log.topics[0] === EVENT_LOG2_SIG &&
            log.topics[1] === ORDER_CANCELLED_HASH) {

            orderKey = log.topics[2];
            console.log("\n❌ ORDER CANCELLED");
            console.log("  Order Key:", orderKey);

            // Decode the event data
            if (log.data && log.data !== '0x') {
                console.log("\n  📊 Event Data Analysis:");
                console.log("  Raw data length:", log.data.length);
                console.log("  Raw data (first 200 chars):", log.data.substring(0, 200));

                try {
                    // The OrderCancelled event has this structure:
                    // event OrderCancelled(bytes32 indexed key, address indexed account, bytes32 indexed reasonBytes, string reason)
                    // Topics: [signature, key, account, reasonBytes]

                    // The second topic is the order key
                    // The third topic is the account (what we were seeing)
                    // The fourth topic is the reasonBytes (if it exists)
                    if (log.topics[3]) {
                        const accountFromTopic = '0x' + log.topics[3].slice(-40);
                        console.log("  Account (indexed):", accountFromTopic);
                    }

                    // Look for reasonBytes in topic[4] if it exists
                    if (log.topics[4]) {
                        cancellationReasonBytes = log.topics[4];
                        console.log("  Reason bytes (indexed):", cancellationReasonBytes);

                        // Try to decode common reason bytes
                        const reasonMap = {
                            [ethers.utils.id("EMPTY_DECREASE")]: "EMPTY_DECREASE - Size delta is zero",
                            [ethers.utils.id("INVALID_DECREASE_ORDER_SIZE")]: "INVALID_DECREASE_ORDER_SIZE - Trying to decrease more than position size",
                            [ethers.utils.id("POSITION_NOT_FOUND")]: "POSITION_NOT_FOUND - No position to decrease",
                            [ethers.utils.id("INSUFFICIENT_COLLATERAL")]: "INSUFFICIENT_COLLATERAL - Not enough collateral",
                            [ethers.utils.id("MIN_COLLATERAL_USD_EXCEEDED")]: "MIN_COLLATERAL_USD_EXCEEDED - Position would have too little collateral",
                            [ethers.utils.id("LIQUIDATION_REQUIRED")]: "LIQUIDATION_REQUIRED - Position should be liquidated",
                            [ethers.utils.id("POSITION_SIZE_EXCEEDED")]: "POSITION_SIZE_EXCEEDED - Decrease amount exceeds position size"
                        };

                        if (reasonMap[cancellationReasonBytes]) {
                            console.log("  ✅ Decoded reason:", reasonMap[cancellationReasonBytes]);
                        }
                    }

                    // Try to decode the non-indexed data
                    // The data contains: handler address, reason string, and raw reason bytes
                    const dataWithoutPrefix = log.data.slice(2); // Remove 0x

                    console.log("\n  Decoding event data:");

                    // First 32 bytes (64 hex chars) is the handler address
                    const handlerAddress = '0x' + dataWithoutPrefix.slice(24, 64); // Skip padding
                    console.log("  Handler:", handlerAddress);

                    // Next is the offset to the reason string (should be 0x60 = 96 decimal)
                    const reasonOffset = parseInt(dataWithoutPrefix.slice(64, 128), 16);
                    console.log("  Reason offset:", reasonOffset);

                    // Then the offset to raw reason bytes (should be after the string)
                    const rawReasonOffset = parseInt(dataWithoutPrefix.slice(128, 192), 16);
                    console.log("  Raw reason offset:", rawReasonOffset);

                    // Now decode the reason string
                    if (reasonOffset > 0) {
                        // Move to the string location (offset is in bytes, we're working in hex chars)
                        const stringStart = reasonOffset * 2;
                        const stringLength = parseInt(dataWithoutPrefix.slice(stringStart, stringStart + 64), 16);

                        if (stringLength > 0 && stringLength < 1000) {
                            const stringData = dataWithoutPrefix.slice(stringStart + 64, stringStart + 64 + stringLength * 2);
                            const reasonString = Buffer.from(stringData, 'hex').toString('utf8');
                            console.log("  ✅ Reason string:", reasonString);
                            cancellationReason = reasonString;
                        }
                    }

                } catch (e) {
                    console.log("  Could not decode event data:", e.message);
                }
            }
        }

        // Check for OrderExecuted event (shouldn't happen if cancelled)
        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase() &&
            log.topics[0] === EVENT_LOG2_SIG &&
            log.topics[1] === ORDER_EXECUTED_HASH) {
            console.log("\n✅ ORDER EXECUTED (unexpected!)");
            console.log("  Order Key:", log.topics[2]);
        }
    }

    // If we found the order key, fetch more details
    if (orderKey) {
        console.log("\n📍 Fetching Order Details from DataStore...");

        const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

        // Check if order still exists (it shouldn't after cancellation)
        const ORDER_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"])
        );
        const orderExists = await dataStore.containsBytes32(ORDER_LIST, orderKey);
        console.log("  Order still in ORDER_LIST:", orderExists ? "Yes (unexpected)" : "No (expected)");
    }

    console.log("\n🔍 Summary:");
    if (cancellationReason) {
        console.log("  The order was cancelled with reason:", cancellationReason);
    } else if (cancellationReasonBytes) {
        console.log("  The order was cancelled with reason bytes:", cancellationReasonBytes);
        console.log("  (Could not decode to human-readable reason)");
    } else {
        console.log("  Could not determine cancellation reason from events");
    }

    console.log("\n💡 Common cancellation reasons:");
    console.log("  • Trying to decrease more than position size");
    console.log("  • Position would have less than minimum collateral after decrease");
    console.log("  • Price impact too high");
    console.log("  • Position not found");
}

main().catch(console.error);