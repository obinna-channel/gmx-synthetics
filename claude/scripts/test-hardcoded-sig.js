const { ethers } = require("hardhat");

/**
 * Test script using hardcoded EventLog1 signature from Python code
 */

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";

    // Hardcoded signature from Python code
    const EVENT_LOG1_SIG = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - 100000;

    console.log("\n=== Testing Hardcoded EventLog1 Signature ===\n");
    console.log(`Current Block: ${currentBlock}`);
    console.log(`Searching from: ${fromBlock}`);
    console.log(`Using signature: ${EVENT_LOG1_SIG}\n`);

    // First: Query for ANY EventLog1 events
    console.log("1. Querying for ALL EventLog1 events (no filters)...");

    const allFilter = {
        address: EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [EVENT_LOG1_SIG]
    };

    const allLogs = await ethers.provider.getLogs(allFilter);
    console.log(`   ✅ Found ${allLogs.length} total EventLog1 events\n`);

    if (allLogs.length === 0) {
        console.log("❌ No EventLog1 events found with this signature!");
        return;
    }

    // Second: Decode and look for PositionDecrease
    console.log("2. Decoding events to find PositionDecrease...");

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
    const eventNames = new Set();
    let positionDecreaseCount = 0;
    let positionDecreaseForAccount = 0;

    for (const log of allLogs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            if (parsed.name === "EventLog1") {
                const eventName = parsed.args.eventName;
                eventNames.add(eventName);

                if (eventName === "PositionDecrease") {
                    positionDecreaseCount++;

                    // Check if this is for our account
                    const eventData = parsed.args.eventData;
                    const account = eventData.addressItems.items[0].value;

                    if (account.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                        positionDecreaseForAccount++;
                    }
                }
            }
        } catch (e) {
            // Skip unparseable
        }
    }

    console.log(`   Event types found: ${Array.from(eventNames).sort().join(", ")}`);
    console.log(`   ✅ Total PositionDecrease events: ${positionDecreaseCount}`);
    console.log(`   ✅ PositionDecrease for account: ${positionDecreaseForAccount}\n`);

    // Third: Try filtering by PositionDecrease in topic1
    console.log("3. Querying with PositionDecrease in topic1...");

    const positionDecreaseHash = ethers.utils.id("PositionDecrease");
    console.log(`   PositionDecrease hash: ${positionDecreaseHash}`);

    const decreaseFilter = {
        address: EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            EVENT_LOG1_SIG,
            positionDecreaseHash
        ]
    };

    const decreaseLogs = await ethers.provider.getLogs(decreaseFilter);
    console.log(`   ✅ Found ${decreaseLogs.length} PositionDecrease events\n`);

    // Fourth: Try filtering by account in topic2
    console.log("4. Querying with account in topic2...");

    const accountBytes32 = ethers.utils.hexZeroPad(ACCOUNT_ADDRESS, 32);
    console.log(`   Account as bytes32: ${accountBytes32}`);

    const accountFilter = {
        address: EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            EVENT_LOG1_SIG,
            positionDecreaseHash,
            accountBytes32
        ]
    };

    const accountLogs = await ethers.provider.getLogs(accountFilter);
    console.log(`   ✅ Found ${accountLogs.length} PositionDecrease events for account\n`);

    console.log("═".repeat(70));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
