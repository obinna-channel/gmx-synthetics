const { ethers } = require("hardhat");

async function main() {
    const TX_HASH = "0x0e17ca1d7fa3fced6e93a0be1123c9192c7c2947d7af61b3ebccc49c41e16d4e";
    const ORDER_KEY = "0x08339e4f2c7b8ff177d4066ab50b4c31bd9f359bc680e22e48f6865887299165";

    // The suspicious address from reason bytes
    const REASON_ADDRESS = "0x83f2d66af7f794893c31c0b32bd2d4ce826871d7";

    console.log("=== Analyzing NGN Order Cancellation ===\n");
    console.log("TX Hash:", TX_HASH);
    console.log("Order Key:", ORDER_KEY);
    console.log();

    const provider = ethers.provider;

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
        console.log("❌ Receipt not found!");
        return;
    }

    console.log("📋 Transaction Info:");
    console.log("   Status:", receipt.status === 1 ? "✅ Success (no revert)" : "❌ Failed");
    console.log("   Block:", receipt.blockNumber);
    console.log("   Gas Used:", receipt.gasUsed.toString());
    console.log();

    // GMX uses EventEmitter pattern - let's decode those events
    const EVENT_DISPATCHER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";

    const eventEmitterInterface = new ethers.utils.Interface([
        "event EventLog1(address msgSender, string eventName, string indexed eventNameHash, bytes32 indexed topic1, tuple(tuple(address[] addressItems, uint256[] uintItems, int256[] intItems, bool[] boolItems, bytes32[] bytes32Items, bytes[] bytesItems, string[] stringItems) items, tuple(address[] addressItems, uint256[] uintItems, int256[] intItems, bool[] boolItems, bytes32[] bytes32Items, bytes[] bytesItems, string[] stringItems) arrayItems) eventData)"
    ]);

    console.log("🔍 Searching for OrderCancelled event in transaction logs...\n");

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === EVENT_DISPATCHER.toLowerCase()) {
            try {
                const parsed = eventEmitterInterface.parseLog(log);

                if (parsed.args.eventName === "OrderCancelled") {
                    console.log("✅ Found OrderCancelled event!\n");

                    const eventData = parsed.args.eventData;

                    // Extract order key
                    if (eventData.items.bytes32Items && eventData.items.bytes32Items.length > 0) {
                        console.log("📄 Order Key:", eventData.items.bytes32Items[0]);
                    }

                    // Extract reason and reasonBytes
                    if (eventData.items.bytesItems && eventData.items.bytesItems.length >= 2) {
                        const reason = eventData.items.bytesItems[0];
                        const reasonBytes = eventData.items.bytesItems[1];

                        console.log("\n🔍 Cancellation Reason:");
                        console.log("   Reason (hex):", reason);
                        console.log("   ReasonBytes (hex):", reasonBytes);
                        console.log();

                        // Try to decode reason as string
                        try {
                            if (reason && reason !== '0x') {
                                const reasonString = ethers.utils.toUtf8String(reason);
                                console.log("   📝 Reason (decoded):", reasonString);
                            }
                        } catch (e) {
                            console.log("   ⚠️  Could not decode reason as UTF-8 string");
                        }

                        // Decode reasonBytes
                        if (reasonBytes && reasonBytes !== '0x') {
                            console.log("\n   🔬 Analyzing ReasonBytes:");

                            // Check if it's an address (32 bytes with padding)
                            if (reasonBytes.length === 66) {
                                const address = '0x' + reasonBytes.slice(26);
                                if (ethers.utils.isAddress(address)) {
                                    console.log("      Contains Address:", address);

                                    // Check what this address is
                                    const code = await provider.getCode(address);
                                    if (code !== '0x') {
                                        console.log("      Type: Contract (has code)");
                                    } else {
                                        console.log("      Type: EOA or empty address");
                                    }
                                }
                            }

                            // Try to decode as custom error
                            const selector = reasonBytes.slice(0, 10);
                            console.log("\n      Error Selector:", selector);

                            // Common error selectors
                            if (selector === '0x08c379a0') {
                                console.log("      Error Type: Error(string)");
                                try {
                                    const decoded = ethers.utils.defaultAbiCoder.decode(['string'], '0x' + reasonBytes.slice(10));
                                    console.log("      ❌ Message:", decoded[0]);
                                } catch (e) {}
                            }
                        }
                    }

                    // Print all event data for analysis
                    console.log("\n📊 Full Event Data:");
                    if (eventData.items.addressItems && eventData.items.addressItems.length > 0) {
                        console.log("\n   Address Items:");
                        eventData.items.addressItems.forEach((addr, i) => {
                            console.log(`      [${i}] ${addr}`);
                        });
                    }
                    if (eventData.items.uintItems && eventData.items.uintItems.length > 0) {
                        console.log("\n   Uint Items:");
                        eventData.items.uintItems.forEach((val, i) => {
                            console.log(`      [${i}] ${val.toString()}`);
                        });
                    }
                    if (eventData.items.stringItems && eventData.items.stringItems.length > 0) {
                        console.log("\n   String Items:");
                        eventData.items.stringItems.forEach((str, i) => {
                            console.log(`      [${i}] ${str}`);
                        });
                    }
                }
            } catch (e) {
                // Not the event we're looking for
            }
        }
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n🔎 Checking what address", REASON_ADDRESS, "is...\n");

    const code = await provider.getCode(REASON_ADDRESS);
    if (code !== '0x') {
        console.log("This is a contract with bytecode");
        console.log("Bytecode length:", code.length);
    } else {
        console.log("This is an EOA or has no code deployed");
    }
}

main().catch(console.error);
