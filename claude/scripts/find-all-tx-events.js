const { ethers } = require("hardhat");

/**
 * Find ALL EventEmitter events in a specific transaction
 */

async function main() {
    const TX_HASH = "0x1420d06b5ab4c564af39d5dc7463212acfb3de879db631899bcf263dfd2a1788";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const EVENT_LOG1_SIG = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         ALL EVENTEMITTER EVENTS IN TRANSACTION                   ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    console.log(`📋 Transaction: ${TX_HASH}\n`);

    // Get transaction receipt to find the block
    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
    if (!receipt) {
        console.log("❌ Transaction not found!");
        return;
    }

    console.log(`✅ Transaction found in block ${receipt.blockNumber}`);
    console.log(`   Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Gas Used: ${receipt.gasUsed}\n`);

    // Query all EventLog1 events from this specific block and transaction
    const filter = {
        address: EVENT_EMITTER,
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
        topics: [EVENT_LOG1_SIG]
    };

    console.log(`📊 Querying EventEmitter for all events in this block...`);
    const logs = await ethers.provider.getLogs(filter);

    // Filter to only this transaction
    const txLogs = logs.filter(log => log.transactionHash === TX_HASH);
    console.log(`   ✅ Found ${txLogs.length} EventLog1 events in this transaction\n`);

    if (txLogs.length === 0) {
        console.log("❌ No EventEmitter events found in this transaction!");
        return;
    }

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    // Helper function to get value from items by key
    function getValueFromItems(items, key) {
        if (!items || !items.items) return null;
        for (const item of items.items) {
            if (item.key === key) {
                return item.value;
            }
        }
        return null;
    }

    console.log("═".repeat(70));
    console.log("\n📜 ALL EVENTS IN TRANSACTION (in order)\n");
    console.log("═".repeat(70));

    for (let i = 0; i < txLogs.length; i++) {
        const log = txLogs[i];

        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventName = parsed.args[1];
            const eventData = parsed.args[4];

            console.log(`\n${i + 1}. EVENT: ${eventName}`);
            console.log(`   Log Index: ${log.logIndex}`);
            console.log(`   ─────────────────────────────────────────────────────────────`);

            // Display relevant data based on event type
            if (eventName === "PositionDecrease") {
                const account = eventData.addressItems.items[0].value;
                const market = eventData.addressItems.items[1].value;
                const sizeDeltaUsd = ethers.utils.formatUnits(eventData.uintItems.items[12].value, 30);
                const collateralDelta = ethers.utils.formatUnits(eventData.uintItems.items[14].value, 6);
                const basePnl = ethers.utils.formatUnits(eventData.intItems.items[1].value, 30);
                const priceImpact = ethers.utils.formatUnits(eventData.intItems.items[0].value, 30);

                console.log(`   Account: ${account}`);
                console.log(`   Market: ${market}`);
                console.log(`   Size Delta: $${parseFloat(sizeDeltaUsd).toFixed(2)}`);
                console.log(`   Collateral Delta: ${parseFloat(collateralDelta).toFixed(6)} mUSD`);
                console.log(`   Base PnL: ${parseFloat(basePnl) >= 0 ? '+' : ''}$${parseFloat(basePnl).toFixed(6)}`);
                console.log(`   Price Impact: ${parseFloat(priceImpact) >= 0 ? '+' : ''}$${parseFloat(priceImpact).toFixed(6)}`);
            }
            else if (eventName === "PositionFeesCollected") {
                const orderKey = getValueFromItems(eventData.bytes32Items, 'orderKey');
                const totalCost = getValueFromItems(eventData.uintItems, 'totalCostAmount');
                const positionFee = getValueFromItems(eventData.uintItems, 'positionFeeAmount');
                const borrowingFee = getValueFromItems(eventData.uintItems, 'borrowingFeeAmount');
                const fundingFee = getValueFromItems(eventData.uintItems, 'fundingFeeAmount');
                const claimableLong = getValueFromItems(eventData.uintItems, 'claimableLongTokenAmount');
                const claimableShort = getValueFromItems(eventData.uintItems, 'claimableShortTokenAmount');

                console.log(`   Order Key: ${orderKey}`);
                console.log(`   Total Cost: ${ethers.utils.formatUnits(totalCost || 0, 6)} mUSD`);
                console.log(`   Position Fee: ${ethers.utils.formatUnits(positionFee || 0, 6)} mUSD`);
                console.log(`   Borrowing Fee: ${ethers.utils.formatUnits(borrowingFee || 0, 6)} mUSD`);
                console.log(`   Funding Fee: ${ethers.utils.formatUnits(fundingFee || 0, 30)} USD`);
                console.log(`   Claimable Long: ${ethers.utils.formatUnits(claimableLong || 0, 6)} mUSD`);
                console.log(`   Claimable Short: ${ethers.utils.formatUnits(claimableShort || 0, 6)} mUSD`);
            }
            else if (eventName === "OrderExecuted") {
                const orderKey = getValueFromItems(eventData.bytes32Items, 'key');
                const account = getValueFromItems(eventData.addressItems, 'account');

                console.log(`   Order Key: ${orderKey}`);
                console.log(`   Account: ${account}`);
            }
            else if (eventName === "OrderCreated") {
                const orderKey = getValueFromItems(eventData.bytes32Items, 'key');
                const orderType = getValueFromItems(eventData.uintItems, 'orderType');
                const account = getValueFromItems(eventData.addressItems, 'account');

                console.log(`   Order Key: ${orderKey}`);
                console.log(`   Order Type: ${orderType}`);
                console.log(`   Account: ${account}`);
            }
            else {
                // For other events, show what data is available
                console.log(`   Address items: ${eventData.addressItems?.items?.length || 0}`);
                console.log(`   Uint items: ${eventData.uintItems?.items?.length || 0}`);
                console.log(`   Int items: ${eventData.intItems?.items?.length || 0}`);
                console.log(`   Bool items: ${eventData.boolItems?.items?.length || 0}`);
                console.log(`   Bytes32 items: ${eventData.bytes32Items?.items?.length || 0}`);

                // Try to show first few items
                if (eventData.addressItems?.items?.length > 0) {
                    console.log(`\n   First address item: ${eventData.addressItems.items[0].key} = ${eventData.addressItems.items[0].value}`);
                }
                if (eventData.uintItems?.items?.length > 0) {
                    console.log(`   First uint item: ${eventData.uintItems.items[0].key} = ${eventData.uintItems.items[0].value}`);
                }
            }

        } catch (error) {
            console.log(`   ❌ Error parsing event: ${error.message}`);
        }
    }

    console.log("\n" + "═".repeat(70));
    console.log(`✅ Found ${txLogs.length} total events in transaction`);
    console.log("═".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
