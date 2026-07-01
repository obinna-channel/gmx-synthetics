const { ethers } = require("hardhat");

async function main() {
    const TX_HASH = "0x0e17ca1d7fa3fced6e93a0be1123c9192c7c2947d7af61b3ebccc49c41e16d4e";
    const ORDER_KEY = "0x08339e4f2c7b8ff177d4066ab50b4c31bd9f359bc680e22e48f6865887299165";

    console.log("=== Analyzing Cancelled Order Transaction ===\n");
    console.log("TX Hash:", TX_HASH);
    console.log("Order Key:", ORDER_KEY);
    console.log();

    const provider = ethers.provider;

    // Get transaction receipt
    console.log("📋 Fetching transaction receipt...");
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
        console.log("❌ Receipt not found!");
        return;
    }

    console.log("   Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("   Block:", receipt.blockNumber);
    console.log("   Gas Used:", receipt.gasUsed.toString());
    console.log();

    // OrderCancelled event topic
    const ORDER_CANCELLED_TOPIC = ethers.utils.id("OrderCancelled(bytes32,bytes,bytes)");

    console.log("🔍 Looking for OrderCancelled event...\n");

    // Find OrderCancelled events
    const cancelledEvents = receipt.logs.filter(log =>
        log.topics[0] === ORDER_CANCELLED_TOPIC
    );

    if (cancelledEvents.length === 0) {
        console.log("⚠️  No OrderCancelled events found");
        return;
    }

    for (let i = 0; i < cancelledEvents.length; i++) {
        const event = cancelledEvents[i];
        console.log(`📄 OrderCancelled Event ${i + 1}:\n`);

        try {
            // Decode the event
            const iface = new ethers.utils.Interface([
                "event OrderCancelled(bytes32 key, bytes reason, bytes reasonBytes)"
            ]);

            const decoded = iface.parseLog(event);
            const orderKey = decoded.args.key;
            const reason = decoded.args.reason;
            const reasonBytes = decoded.args.reasonBytes;

            console.log("   Order Key:", orderKey);
            console.log();
            console.log("   Reason (hex):", reason);
            console.log("   Reason Bytes (hex):", reasonBytes);
            console.log();

            // Try to decode reason as string
            try {
                if (reason && reason !== '0x') {
                    const reasonString = ethers.utils.toUtf8String(reason);
                    console.log("   📝 Reason (decoded as string):", reasonString);
                }
            } catch (e) {
                console.log("   ⚠️  Could not decode reason as UTF-8 string");
            }

            // Try to decode reasonBytes
            console.log("\n   🔍 Analyzing reasonBytes...");

            if (reasonBytes && reasonBytes.length > 2) {
                // Check if it's an error selector + data
                const selector = reasonBytes.slice(0, 10);
                console.log("   Selector:", selector);

                // Common GMX error selectors
                const errorSignatures = {
                    '0x08c379a0': 'Error(string)',
                    '0x4e487b71': 'Panic(uint256)',
                    '0x3e99e3e4': 'InsufficientReserve',
                    // Add more as needed
                };

                if (errorSignatures[selector]) {
                    console.log("   Known Error:", errorSignatures[selector]);
                }

                // Try to decode as Error(string)
                if (selector === '0x08c379a0') {
                    try {
                        const decoded = ethers.utils.defaultAbiCoder.decode(
                            ['string'],
                            '0x' + reasonBytes.slice(10)
                        );
                        console.log("\n   ❌ Error Message:", decoded[0]);
                    } catch (e) {
                        console.log("   Could not decode as Error(string)");
                    }
                }

                // Try to decode as Panic(uint256)
                if (selector === '0x4e487b71') {
                    try {
                        const decoded = ethers.utils.defaultAbiCoder.decode(
                            ['uint256'],
                            '0x' + reasonBytes.slice(10)
                        );
                        console.log("\n   ❌ Panic Code:", decoded[0].toString());
                    } catch (e) {
                        console.log("   Could not decode as Panic(uint256)");
                    }
                }

                // If no selector match, try to decode as address (for some custom errors)
                if (!errorSignatures[selector]) {
                    try {
                        if (reasonBytes.length === 66) { // 0x + 64 chars = address with padding
                            const address = '0x' + reasonBytes.slice(26);
                            if (ethers.utils.isAddress(address)) {
                                console.log("\n   📍 Contains Address:", address);
                            }
                        }
                    } catch (e) {
                        // Ignore
                    }

                    // Try as raw data decode
                    console.log("\n   🔬 Attempting various decodings...");

                    // Try as uint256
                    try {
                        const value = ethers.BigNumber.from(reasonBytes);
                        console.log("   As uint256:", value.toString());
                    } catch (e) {}

                    // Try as bytes32
                    try {
                        if (reasonBytes.length === 66) {
                            console.log("   As bytes32:", reasonBytes);
                        }
                    } catch (e) {}
                }
            }

        } catch (error) {
            console.log("   ❌ Error decoding event:", error.message);
        }

        console.log("\n" + "=".repeat(80) + "\n");
    }

    // Also check for any other relevant events
    console.log("📊 All events in transaction:");
    console.log(`   Total logs: ${receipt.logs.length}\n`);

    // Show first few event topics
    receipt.logs.slice(0, 10).forEach((log, idx) => {
        console.log(`   Log ${idx + 1}:`);
        console.log(`      Address: ${log.address}`);
        console.log(`      Topic 0: ${log.topics[0]}`);
    });
}

main().catch(console.error);
