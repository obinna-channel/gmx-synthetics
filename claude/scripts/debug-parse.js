const { ethers } = require("hardhat");

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const EVENT_LOG1_SIG = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";

    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - 100000;

    console.log("\n=== Debug Event Parsing ===\n");

    const positionDecreaseHash = ethers.utils.id("PositionDecrease");
    const accountBytes32 = ethers.utils.hexZeroPad(ACCOUNT_ADDRESS, 32);

    const filter = {
        address: EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            EVENT_LOG1_SIG,
            positionDecreaseHash,
            accountBytes32
        ]
    };

    console.log("Querying for PositionDecrease events...");
    const logs = await ethers.provider.getLogs(filter);
    console.log(`Found ${logs.length} events\n`);

    if (logs.length === 0) {
        console.log("No events found!");
        return;
    }

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    // Parse the first event and dump everything
    const log = logs[0];
    console.log("=== First Event ===");
    console.log(`Block: ${log.blockNumber}`);
    console.log(`Tx: ${log.transactionHash}`);
    console.log(`Topics: ${log.topics.length}`);
    log.topics.forEach((topic, i) => {
        console.log(`  topic${i}: ${topic}`);
    });
    console.log(`\nData length: ${log.data.length} bytes\n`);

    try {
        const parsed = eventEmitter.interface.parseLog(log);
        console.log("=== Parsed Event ===");
        console.log(`Name: ${parsed.name}`);
        console.log(`Args keys: ${Object.keys(parsed.args)}`);
        console.log(`\nArgs content:`);

        Object.keys(parsed.args).forEach(key => {
            // Skip numeric keys
            if (isNaN(key)) {
                const value = parsed.args[key];
                if (typeof value === 'string') {
                    console.log(`  ${key}: ${value}`);
                } else if (typeof value === 'object') {
                    console.log(`  ${key}: [object]`);
                    if (value.items) {
                        console.log(`    - has 'items' property`);
                    }
                } else {
                    console.log(`  ${key}: ${value}`);
                }
            }
        });

        console.log(`\neventName: ${parsed.args.eventName}`);
        console.log(`eventData exists: ${!!parsed.args.eventData}`);

        if (parsed.args.eventData) {
            console.log(`\neventData structure:`);
            console.log(`  addressItems: ${!!parsed.args.eventData.addressItems}`);
            if (parsed.args.eventData.addressItems) {
                console.log(`    items length: ${parsed.args.eventData.addressItems.items.length}`);
                if (parsed.args.eventData.addressItems.items.length > 0) {
                    console.log(`    first item: ${JSON.stringify(parsed.args.eventData.addressItems.items[0])}`);
                }
            }
        }
    } catch (error) {
        console.log(`\n❌ Parse error: ${error.message}`);
        console.log(error.stack);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
