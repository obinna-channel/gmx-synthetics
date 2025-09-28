const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    console.log("=== Checking Recent Orders ===\n");
    console.log("User:", signer.address);

    // Contract addresses
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check for any existing orders
    const ORDER_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"])
    );

    // Get recent blocks to check events
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - 1000; // Look back 1000 blocks

    console.log(`Checking blocks ${fromBlock} to ${currentBlock}...\n`);

    // Event signatures
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
    const ORDER_CREATED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCreated"));
    const ORDER_EXECUTED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderExecuted"));
    const ORDER_CANCELLED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCancelled"));

    // Get all relevant events
    const filter = {
        address: EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock
    };

    const logs = await ethers.provider.getLogs(filter);

    // Track orders
    const orders = new Map();

    for (const log of logs) {
        if (log.topics[0] === EVENT_LOG2_SIG) {
            const eventType = log.topics[1];
            const orderKey = log.topics[2];

            if (!orders.has(orderKey)) {
                orders.set(orderKey, {
                    key: orderKey,
                    created: false,
                    executed: false,
                    cancelled: false,
                    block: log.blockNumber,
                    tx: log.transactionHash
                });
            }

            const order = orders.get(orderKey);

            if (eventType === ORDER_CREATED_HASH) {
                order.created = true;
                order.createdBlock = log.blockNumber;
                order.createdTx = log.transactionHash;
            } else if (eventType === ORDER_EXECUTED_HASH) {
                order.executed = true;
                order.executedBlock = log.blockNumber;
                order.executedTx = log.transactionHash;
            } else if (eventType === ORDER_CANCELLED_HASH) {
                order.cancelled = true;
                order.cancelledBlock = log.blockNumber;
                order.cancelledTx = log.transactionHash;
                order.cancelData = log.data;
            }
        }
    }

    // Filter for user's orders
    console.log("📋 Recent Orders:\n");

    let userOrders = [];
    for (const [key, order] of orders) {
        // Check if this order is from our user
        if (order.createdTx) {
            const tx = await ethers.provider.getTransaction(order.createdTx);
            if (tx.from.toLowerCase() === signer.address.toLowerCase()) {
                userOrders.push(order);
            }
        }
    }

    if (userOrders.length === 0) {
        console.log("No recent orders found for your address.");
        return;
    }

    // Sort by block number (most recent first)
    userOrders.sort((a, b) => b.createdBlock - a.createdBlock);

    // Show latest orders
    for (let i = 0; i < Math.min(5, userOrders.length); i++) {
        const order = userOrders[i];
        console.log(`\n${i + 1}. Order Key: ${order.key}`);
        console.log(`   Created: Block ${order.createdBlock} (TX: ${order.createdTx})`);

        if (order.executed) {
            console.log(`   ✅ EXECUTED: Block ${order.executedBlock}`);
        }

        if (order.cancelled) {
            console.log(`   ❌ CANCELLED: Block ${order.cancelledBlock}`);

            // Try to decode cancellation reason
            if (order.cancelData && order.cancelData !== '0x') {
                console.log(`   Cancel TX: ${order.cancelledTx}`);

                try {
                    const data = order.cancelData.slice(2); // Remove 0x
                    if (data.length >= 64) {
                        // First 32 bytes is usually the keeper address
                        const keeperAddress = '0x' + data.slice(24, 64);
                        console.log(`   Keeper: ${keeperAddress}`);
                    }
                } catch (e) {
                    console.log(`   Raw cancel data: ${order.cancelData.slice(0, 66)}...`);
                }
            }
        }

        // Check if order still exists in storage
        const orderExists = await dataStore.containsBytes32(ORDER_LIST, order.key);
        if (orderExists && !order.executed && !order.cancelled) {
            console.log(`   ⏳ PENDING: Order still in storage, waiting for execution`);
        } else if (!orderExists && !order.executed && !order.cancelled) {
            console.log(`   ⚠️  Order removed from storage but no execution/cancellation event`);
        }
    }

    // Check most recent failed order
    const failedOrders = userOrders.filter(o => o.cancelled);
    if (failedOrders.length > 0) {
        console.log("\n\n=== Most Recent Failed Order ===");
        const latestFailed = failedOrders[0];
        console.log(`Order Key: ${latestFailed.key}`);
        console.log(`Created TX: https://sepolia.arbiscan.io/tx/${latestFailed.createdTx}`);
        console.log(`Cancelled TX: https://sepolia.arbiscan.io/tx/${latestFailed.cancelledTx}`);

        // Get more details about the order
        console.log("\n📊 Checking order details...");

        // Try to get the creation transaction
        const createTx = await ethers.provider.getTransaction(latestFailed.createdTx);
        const createReceipt = await ethers.provider.getTransactionReceipt(latestFailed.createdTx);

        if (createTx && createReceipt) {
            console.log(`Gas used for creation: ${createReceipt.gasUsed.toString()}`);
            console.log(`Block timestamp: ${(await ethers.provider.getBlock(createReceipt.blockNumber)).timestamp}`);
        }
    }
}

main().catch(console.error);