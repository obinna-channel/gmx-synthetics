const { ethers } = require("hardhat");

async function main() {
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = currentBlock - 10000;

    console.log("Testing if PositionDecrease events exist at all...");
    console.log("Current block:", currentBlock);
    console.log("Searching from:", fromBlock);

    // Query for ANY EventLog1 events (no topic filter for account)
    const filter = {
        address: EVENT_EMITTER,
        fromBlock: fromBlock,
        toBlock: currentBlock,
        topics: [
            ethers.utils.id("EventLog1(address,string,string,bytes32,bytes)")
        ]
    };

    const logs = await ethers.provider.getLogs(filter);
    console.log("\nTotal EventLog1 events in last 10k blocks:", logs.length);

    if (logs.length > 0) {
        const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);
        const eventNames = new Set();
        let positionDecreaseCount = 0;

        for (const log of logs) {
            try {
                const parsed = eventEmitter.interface.parseLog(log);
                if (parsed.name === "EventLog1") {
                    eventNames.add(parsed.args.eventName);
                    if (parsed.args.eventName === "PositionDecrease") {
                        positionDecreaseCount++;
                    }
                }
            } catch (e) {}
        }

        console.log("\nEvent types found:", Array.from(eventNames).sort().join(", "));
        console.log("\nPositionDecrease events found:", positionDecreaseCount);
    }
}

main().then(() => process.exit(0)).catch(console.error);
