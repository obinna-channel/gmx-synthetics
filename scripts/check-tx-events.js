const { ethers } = require("hardhat");

async function main() {
    const TX_HASH = "0x0e17ca1d7fa3fced6e93a0be1123c9192c7c2947d7af61b3ebccc49c41e16d4e";

    console.log("=== Checking All Events in Transaction ===\n");
    console.log("TX Hash:", TX_HASH);
    console.log();

    const provider = ethers.provider;

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(TX_HASH);

    if (!receipt) {
        console.log("❌ Receipt not found!");
        return;
    }

    console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("Block:", receipt.blockNumber);
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log();
    console.log("Total Events:", receipt.logs.length);
    console.log();

    // Common GMX event signatures
    const knownEvents = {
        [ethers.utils.id("OrderCreated(bytes32,tuple)")]: "OrderCreated",
        [ethers.utils.id("OrderCancelled(bytes32,bytes,bytes)")]: "OrderCancelled",
        [ethers.utils.id("OrderExecuted(bytes32,uint256)")]: "OrderExecuted",
        [ethers.utils.id("OrderUpdated(bytes32,uint256,uint256,uint256)")]: "OrderUpdated",
        [ethers.utils.id("OrderFrozen(bytes32,bytes)")]: "OrderFrozen",
        [ethers.utils.id("PositionIncrease(bytes32,address,address,address,bool,uint256,uint256)")]: "PositionIncrease",
        [ethers.utils.id("PositionDecrease(bytes32,address,address,address,bool,uint256,uint256)")]: "PositionDecrease",
    };

    console.log("📊 Event List:\n");

    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        const topic0 = log.topics[0];
        const eventName = knownEvents[topic0] || "Unknown";

        console.log(`Event ${i + 1}: ${eventName}`);
        console.log(`   Address: ${log.address}`);
        console.log(`   Topic 0: ${topic0}`);

        if (log.topics.length > 1) {
            console.log(`   Topic 1: ${log.topics[1]}`);
        }

        if (log.data && log.data !== '0x') {
            const dataPreview = log.data.length > 66 ? log.data.slice(0, 66) + '...' : log.data;
            console.log(`   Data: ${dataPreview}`);
        }

        console.log();
    }

    // Look for OrderExecuted or OrderCancelled specifically
    console.log("=".repeat(80));
    console.log("\n🔍 Looking for Order-related events...\n");

    const orderExecutedTopic = ethers.utils.id("OrderExecuted(bytes32,uint256)");
    const orderCancelledTopic = ethers.utils.id("OrderCancelled(bytes32,bytes,bytes)");

    const orderEvents = receipt.logs.filter(log =>
        log.topics[0] === orderExecutedTopic || log.topics[0] === orderCancelledTopic
    );

    if (orderEvents.length === 0) {
        console.log("⚠️  No OrderExecuted or OrderCancelled events found");
        console.log("\nThis might indicate:");
        console.log("  1. The order was executed successfully but emitted different events");
        console.log("  2. The keeper is listening to events from a different source");
        console.log("  3. The OrderCancelled event came from a later block");
    } else {
        orderEvents.forEach(event => {
            const eventName = event.topics[0] === orderExecutedTopic ? "OrderExecuted" : "OrderCancelled";
            console.log(`Found: ${eventName}`);
            console.log(`   Topics:`, event.topics);
            console.log(`   Data:`, event.data);
        });
    }
}

main().catch(console.error);
