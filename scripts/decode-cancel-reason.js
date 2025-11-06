const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    // The transaction hash from your cancelled order
    const txHash = "0x581c818b74e3051db9af1948b5750d76011b77f06a338dbeb70ddfb6c55eadca";

    console.log("=== Decoding Order Cancellation ===\n");
    console.log("Transaction:", txHash);

    // Get the transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(txHash);

    if (!receipt) {
        console.log("Transaction not found");
        return;
    }

    console.log("Block:", receipt.blockNumber);
    console.log("Status:", receipt.status === 1 ? "Success" : "Failed");

    // Look for OrderCancelled event
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
    const ORDER_CANCELLED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCancelled"));

    console.log("\n📋 Events in transaction:");

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
            if (log.topics[0] === EVENT_LOG2_SIG && log.topics[1] === ORDER_CANCELLED_HASH) {
                console.log("\n❌ ORDER CANCELLED EVENT FOUND");
                console.log("  Order Key:", log.topics[2]);

                // Decode the data
                if (log.data && log.data !== '0x') {
                    console.log("\n📊 Cancellation Data:");
                    console.log("  Raw data length:", (log.data.length - 2) / 2, "bytes");

                    // The data structure for OrderCancelled includes:
                    // - address (order keeper)
                    // - reasonBytes (dynamic)
                    // - reason string (dynamic)

                    try {
                        // Skip the '0x' prefix
                        const data = log.data.slice(2);

                        // First 32 bytes (64 hex chars) - order keeper address
                        const keeperAddress = '0x' + data.slice(24, 64);
                        console.log("  Order Keeper:", keeperAddress);

                        // Next 32 bytes - offset to reasonBytes
                        const reasonBytesOffset = parseInt(data.slice(64, 128), 16) * 2;

                        // Next 32 bytes - offset to reason string
                        const reasonStringOffset = parseInt(data.slice(128, 192), 16) * 2;

                        if (reasonStringOffset > 0 && reasonStringOffset < data.length) {
                            // Read the reason string
                            const reasonLengthHex = data.slice(reasonStringOffset, reasonStringOffset + 64);
                            const reasonLength = parseInt(reasonLengthHex, 16);

                            if (reasonLength > 0) {
                                const reasonHex = data.slice(reasonStringOffset + 64, reasonStringOffset + 64 + (reasonLength * 2));
                                const reasonString = Buffer.from(reasonHex, 'hex').toString('utf8');
                                console.log("\n  🔴 CANCELLATION REASON:", reasonString);
                            }
                        }

                        // Try to decode any error codes in the reasonBytes
                        if (reasonBytesOffset > 0 && reasonBytesOffset < data.length) {
                            const reasonBytesLengthHex = data.slice(reasonBytesOffset, reasonBytesOffset + 64);
                            const reasonBytesLength = parseInt(reasonBytesLengthHex, 16);

                            if (reasonBytesLength > 0) {
                                const reasonBytesHex = data.slice(reasonBytesOffset + 64, reasonBytesOffset + 64 + (reasonBytesLength * 2));
                                console.log("  Reason bytes:", '0x' + reasonBytesHex);

                                // Check for common error selectors
                                if (reasonBytesHex.length >= 8) {
                                    const errorSelector = '0x' + reasonBytesHex.slice(0, 8);

                                    const knownErrors = {
                                        "0x3e237976": "UnexpectedOrderType",
                                        "0x7c2b27de": "InvalidOrderSizeDeltaUsd",
                                        "0x5c32d106": "EmptyDecrease",
                                        "0x3e0cf1c5": "InvalidDecreaseOrderSize",
                                        "0xfb5d773c": "UnableToGetOppositeToken",
                                        "0x43e7111d": "InvalidPositionMarket",
                                        "0x8bec0276": "InvalidCollateralTokenForMarket",
                                        "0x3c5633b6": "InsufficientReservedUsd",
                                        "0xc446183d": "InsufficientLiquidity"
                                    };

                                    if (knownErrors[errorSelector]) {
                                        console.log("\n  ⚠️  Error Type:", knownErrors[errorSelector]);
                                    }
                                }
                            }
                        }

                    } catch (e) {
                        console.log("  Error decoding:", e.message);
                    }
                }
            }
        }
    }

    // Also check if there's an OrderExecuted event (sometimes both can appear)
    const ORDER_EXECUTED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderExecuted"));

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
            if (log.topics[0] === EVENT_LOG2_SIG && log.topics[1] === ORDER_EXECUTED_HASH) {
                console.log("\n✅ ORDER EXECUTED EVENT ALSO FOUND");
                console.log("  This suggests the order was executed but then cancelled/reverted");
            }
        }
    }
}

main().catch(console.error);