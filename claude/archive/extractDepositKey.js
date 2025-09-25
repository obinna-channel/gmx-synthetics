const { ethers } = require("hardhat");

async function main() {
    console.log("=== EXTRACTING DEPOSIT KEY FROM TRANSACTION ===\n");

    const txHash = "0x92b88929a955535f12fb9098b712c293add1b10bc11e2475223b5546e2d06adf";
    console.log("Transaction:", txHash);

    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);

    console.log("Block:", receipt.blockNumber);
    console.log("Total logs:", receipt.logs.length);

    // Look for EventEmitter logs
    const eventEmitterAddress = "0xE4fFaF6533F6044Fd4E7e19D60e21e019B14E5f1";
    const depositCreatedHash = ethers.utils.id("DepositCreated");

    console.log("\n=== SEARCHING FOR DEPOSIT KEY ===");
    console.log("Looking for EventEmitter logs...");

    let depositKey = null;

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === eventEmitterAddress.toLowerCase()) {
            console.log("\nFound EventEmitter log:");
            console.log("Topics count:", log.topics.length);

            // Check all possible positions for the deposit key
            if (log.topics.length > 1) {
                console.log("Topic[0]:", log.topics[0].slice(0, 10) + "...");
                console.log("Topic[1]:", log.topics[1]);

                // Check if this might be DepositCreated
                if (log.topics.length >= 3) {
                    console.log("Topic[2]:", log.topics[2]);

                    if (log.topics[2] === depositCreatedHash) {
                        depositKey = log.topics[1];
                        console.log("\n✅ FOUND DEPOSIT KEY!");
                        break;
                    }
                }

                // Sometimes the key is in topic[3]
                if (log.topics.length > 3) {
                    console.log("Topic[3]:", log.topics[3]);
                    // Check if topic[3] looks like a deposit key
                    if (!depositKey && log.topics[3].startsWith("0x")) {
                        depositKey = log.topics[3];
                        console.log("\n✅ FOUND DEPOSIT KEY (in topic[3])!");
                    }
                }
            }
        }
    }

    if (depositKey) {
        console.log("\n=== DEPOSIT KEY ===");
        console.log(depositKey);
        console.log("\nSave this key for execution!");
    } else {
        console.log("\n❌ Could not find deposit key in logs");
        console.log("Checking all logs for potential keys...\n");

        // Show all potential keys from logs
        for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            console.log(`Log ${i} from ${log.address.slice(0, 10)}...`);
            for (let j = 0; j < log.topics.length; j++) {
                if (log.topics[j].length === 66) { // 0x + 64 hex chars
                    console.log(`  Topic[${j}]: ${log.topics[j]}`);
                }
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });