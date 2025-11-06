const { ethers } = require("hardhat");

async function main() {
    const txHash = "0xf7faa1eaf56195767fa3285002857e4abc718b76072a8ad2caf38ebd73d9de7a";

    console.log("=== Tracing Failed Transaction ===\n");
    console.log("TX:", txHash);
    console.log("Arbiscan:", `https://sepolia.arbiscan.io/tx/${txHash}\n`);

    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    const tx = await ethers.provider.getTransaction(txHash);

    console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Block:", receipt.blockNumber);

    // Try to get debug trace (requires archive node with debug_traceTransaction)
    try {
        console.log("\n🔍 Attempting to get transaction trace...");
        const trace = await ethers.provider.send("debug_traceTransaction", [txHash, {}]);

        // This likely won't work on most RPC nodes, but worth trying
        console.log("Trace obtained!");
        console.log(JSON.stringify(trace, null, 2).slice(0, 2000));
    } catch (e) {
        console.log("⚠️  Debug trace not available (requires archive node with debug API)");
        console.log("   Error:", e.message.slice(0, 100));
    }

    // Decode the transaction input
    console.log("\n📝 Transaction Input:");
    const orderHandlerInterface = new ethers.utils.Interface([
        "function executeOrder(bytes32 key, tuple(address[] signers, bytes[] data, uint256[] minPrices, uint256[] maxPrices, bytes32[] signatures, address[] priceFeedTokens) oracleParams)"
    ]);

    try {
        const decoded = orderHandlerInterface.parseTransaction({ data: tx.data });
        console.log("Function:", decoded.name);
        console.log("Order Key:", decoded.args.key);
        console.log("Oracle Tokens:", decoded.args.oracleParams.priceFeedTokens);
        console.log("Min Prices:", decoded.args.oracleParams.minPrices.map(p => ethers.utils.formatUnits(p, 12)));
        console.log("Max Prices:", decoded.args.oracleParams.maxPrices.map(p => ethers.utils.formatUnits(p, 12)));
    } catch (e) {
        console.log("Could not decode input:", e.message);
    }

    // Analyze all events in the transaction
    console.log("\n📋 All Events:");
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";

    const eventHashes = {
        [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCancelled"))]: "OrderCancelled",
        [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderExecuted"))]: "OrderExecuted",
        [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PositionDecrease"))]: "PositionDecrease",
    };

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
            if (log.topics[0] === EVENT_LOG2_SIG) {
                const eventName = eventHashes[log.topics[1]] || "Unknown";
                console.log(`  - ${eventName}`);

                if (eventName === "OrderCancelled") {
                    // Try to decode the cancellation reason more carefully
                    const data = log.data.slice(2);

                    // First 32 bytes - keeper address
                    const keeper = '0x' + data.slice(24, 64);
                    console.log(`    Keeper: ${keeper}`);

                    // Offsets to reasonBytes and reason string
                    const reasonBytesOffset = parseInt(data.slice(64, 128), 16) * 2;
                    const reasonStringOffset = parseInt(data.slice(128, 192), 16) * 2;

                    // Try to get reason string
                    if (reasonStringOffset < data.length) {
                        const reasonLength = parseInt(data.slice(reasonStringOffset, reasonStringOffset + 64), 16);
                        if (reasonLength > 0 && reasonLength < 1000) {
                            const reasonHex = data.slice(reasonStringOffset + 64, reasonStringOffset + 64 + (reasonLength * 2));
                            const reasonString = Buffer.from(reasonHex, 'hex').toString('utf8');
                            console.log(`    Reason String: "${reasonString}"`);
                        }
                    }

                    // Try to get reasonBytes
                    if (reasonBytesOffset < data.length) {
                        const reasonBytesLength = parseInt(data.slice(reasonBytesOffset, reasonBytesOffset + 64), 16);
                        if (reasonBytesLength > 0 && reasonBytesLength < 200) {
                            const reasonBytesHex = data.slice(reasonBytesOffset + 64, reasonBytesOffset + 64 + (reasonBytesLength * 2));
                            console.log(`    Reason Bytes: 0x${reasonBytesHex}`);

                            // Check for error selectors
                            if (reasonBytesHex.length >= 8) {
                                const errorSelector = '0x' + reasonBytesHex.slice(0, 8);
                                const knownErrors = {
                                    "0x3c5633b6": "InsufficientReservedUsd",
                                    "0xc446183d": "InsufficientLiquidity",
                                    "0x5c32d106": "EmptyDecrease",
                                    "0x3e0cf1c5": "InvalidDecreaseOrderSize",
                                };
                                if (knownErrors[errorSelector]) {
                                    console.log(`    ⚠️  Error: ${knownErrors[errorSelector]}`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

main().catch(console.error);
