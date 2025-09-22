const { ethers } = require("hardhat");

async function main() {
    console.log("=== EXTRACTING DEPOSIT KEY FROM LAST TRANSACTION ===\n");

    // From deployments folder
    const EVENT_EMITTER = "0x306E6368851c889dc67700E77F278fAB92205aea";

    // Our last successful deposit creation
    const txHash = "0xbd62a9a987b00e82a9f13a7230fbc5f24c9ef681b70bc48012c5bb4575d1d316";

    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    console.log("Transaction:", txHash);
    console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("Total logs:", receipt.logs.length);

    let depositKey = null;

    // Look specifically at EventEmitter logs
    console.log("\n=== CHECKING EVENTEMITTER LOGS ===");
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];

        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
            console.log(`\nEventEmitter Log ${i}:`);
            console.log("Topics count:", log.topics.length);

            // In GMX EventEmitter, events are structured as:
            // EventLog1 or EventLog2 with:
            // - topics[0]: Event signature
            // - topics[1]: First indexed parameter (often the key for deposits)
            // - topics[2]: Event name hash (e.g., keccak256("DepositCreated"))

            if (log.topics.length >= 2) {
                // Check if this is a DepositCreated event
                const depositCreatedHash = ethers.utils.id("DepositCreated");

                for (let j = 0; j < log.topics.length; j++) {
                    console.log(`  Topic[${j}]: ${log.topics[j]}`);

                    if (log.topics[j] === depositCreatedHash) {
                        console.log("  ✅ Found DepositCreated event!");
                        // The deposit key is usually topics[1]
                        depositKey = log.topics[1];
                        console.log("  Deposit Key:", depositKey);
                    }
                }
            }

            // Also check the data field
            if (!depositKey && log.data && log.data.length >= 66) {
                console.log("  Data (first 130 chars):", log.data.substring(0, 130));
                // Sometimes the key is the first 32 bytes of data
                const potentialKey = "0x" + log.data.slice(2, 66);
                console.log("  Potential key from data:", potentialKey);

                // If we haven't found a key yet, use this
                if (!depositKey && potentialKey !== "0x" + "0".repeat(64)) {
                    depositKey = potentialKey;
                }
            }
        }
    }

    if (!depositKey) {
        console.log("\n=== ALTERNATIVE: CHECK ALL LOGS FOR KEY PATTERN ===");
        // Look for any 32-byte value that looks like a key (not all zeros, not a known constant)
        for (const log of receipt.logs) {
            if (log.topics.length > 1) {
                // Topics[1] is often used for keys in events
                const topic = log.topics[1];
                if (topic && !topic.includes("0000000000000000000000000000000")) {
                    console.log("Found non-zero topic[1]:", topic);
                    console.log("From contract:", log.address);
                    depositKey = topic;
                    break;
                }
            }
        }
    }

    if (depositKey) {
        console.log("\n=== DEPOSIT KEY FOUND ===");
        console.log("Key:", depositKey);
        console.log("\nYou can now execute the deposit with this key!");

        // Save to a file for easy access
        const fs = require('fs');
        fs.writeFileSync('deposit-key.txt', depositKey);
        console.log("Key saved to deposit-key.txt");
    } else {
        console.log("\n❌ Could not extract deposit key");
        console.log("The deposit was created but the key extraction failed");
        console.log("You may need to check the DataStore directly");
    }
}

main().catch(console.error);