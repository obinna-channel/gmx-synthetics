const { ethers } = require("hardhat");

async function main() {
    const txHash = "0xbe2763239e5e08e654267a190480b2ad334d84f4abae0767769634f5107cb346";

    console.log("=== Analyzing Transaction Events ===\n");
    console.log("Transaction:", txHash);

    const receipt = await ethers.provider.getTransactionReceipt(txHash);

    if (!receipt) {
        console.log("Transaction not found");
        return;
    }

    console.log("Block:", receipt.blockNumber);
    console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("Total logs:", receipt.logs.length);

    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";

    const knownEventHashes = {
        [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCreated"))]: "OrderCreated",
        [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderExecuted"))]: "OrderExecuted",
        [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCancelled"))]: "OrderCancelled",
        [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderUpdated"))]: "OrderUpdated",
        [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PositionDecrease"))]: "PositionDecrease",
        [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PositionFeesCollected"))]: "PositionFeesCollected",
    };

    console.log("\n📋 All Events:\n");

    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`Event ${i + 1}:`);
        console.log(`  Address: ${log.address}`);
        console.log(`  Topics[0]: ${log.topics[0]}`);

        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
            if (log.topics[0] === EVENT_LOG2_SIG) {
                const eventHash = log.topics[1];
                const eventName = knownEventHashes[eventHash] || "Unknown";
                console.log(`  ⭐ Event Name: ${eventName}`);
                console.log(`  Event Hash: ${eventHash}`);
                console.log(`  Data length: ${(log.data.length - 2) / 2} bytes`);
            }
        }
        console.log("");
    }
}

main().catch(console.error);
