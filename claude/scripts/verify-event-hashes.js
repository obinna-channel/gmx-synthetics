const { ethers } = require("hardhat");

async function main() {
    console.log("=== Verifying Event Hashes ===\n");

    // Test different event signature formats
    console.log("Testing EventLog2 signatures:");
    console.log("-".repeat(60));

    // Version 1: Without 'indexed' in signature (what we're using)
    const sig1 = "EventLog2(address,string,string,bytes32,bytes32,(address[],uint256[],int256[],bool[],bytes32[],bytes[],string[]))";
    const hash1 = ethers.utils.id(sig1);
    console.log("Without 'indexed' keywords:");
    console.log("Signature:", sig1);
    console.log("Hash:", hash1);

    console.log("");

    // Version 2: With 'indexed' in signature (might be the correct one)
    const sig2 = "EventLog2(address,string,string indexed,bytes32 indexed,bytes32 indexed,(address[],uint256[],int256[],bool[],bytes32[],bytes[],string[]))";
    const hash2 = ethers.utils.id(sig2);
    console.log("With 'indexed' keywords:");
    console.log("Signature:", sig2);
    console.log("Hash:", hash2);

    console.log("");

    // Version 3: Simplified tuple notation
    const sig3 = "EventLog2(address,string,string,bytes32,bytes32,tuple)";
    const hash3 = ethers.utils.id(sig3);
    console.log("With simplified tuple:");
    console.log("Signature:", sig3);
    console.log("Hash:", hash3);

    console.log("\n" + "=".repeat(60));

    // OrderCreated hash (this should be consistent)
    console.log("\nOrderCreated string hash:");
    const orderCreatedHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCreated"));
    console.log("Hash:", orderCreatedHash);

    console.log("\n" + "=".repeat(60));
    console.log("\nChecking last transaction for actual event signatures...");

    // Check the actual transaction
    const txHash = "0x6642dbfee5d2cd89110a53c259b6c2d3d1eab92b942aabab62fd691c72db8a93";
    const receipt = await ethers.provider.getTransactionReceipt(txHash);

    if (receipt) {
        const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";

        // Find EventEmitter logs
        const eventEmitterLogs = receipt.logs.filter(
            log => log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()
        );

        console.log(`Found ${eventEmitterLogs.length} events from EventEmitter`);

        if (eventEmitterLogs.length > 0) {
            eventEmitterLogs.forEach((log, index) => {
                console.log(`\nEvent #${index + 1}:`);
                console.log("  Topic[0] (signature):", log.topics[0]);

                // Check which signature matches
                if (log.topics[0] === hash1) {
                    console.log("  ✅ Matches signature WITHOUT 'indexed'");
                } else if (log.topics[0] === hash2) {
                    console.log("  ✅ Matches signature WITH 'indexed'");
                } else if (log.topics[0] === hash3) {
                    console.log("  ✅ Matches simplified tuple signature");
                } else {
                    console.log("  ❌ No match - unknown signature");
                }

                if (log.topics.length > 1) {
                    console.log("  Topic[1] (eventNameHash):", log.topics[1]);
                    if (log.topics[1] === orderCreatedHash) {
                        console.log("  ✅ Is OrderCreated event!");
                    }
                }
            });
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n📝 Summary:");
    console.log("The event listener is currently using:");
    console.log("  EventLog2 hash:", hash1);
    console.log("  OrderCreated hash:", orderCreatedHash);
    console.log("\nCheck if these match what's actually emitted above!");
}

main().catch(console.error);