const { ethers } = require("hardhat");

async function main() {
    console.log("=== FINDING CORRECT DEPOSIT KEY FROM TRANSACTION ===\n");

    const txHash = "0x9ae398e6f284f83270f207eb7781fdc851f9ad9473a6d46553e987c8f665e470";
    console.log("Analyzing transaction:", txHash);

    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
        console.log("❌ Transaction not found");
        return;
    }

    console.log("Transaction found in block:", receipt.blockNumber);
    console.log("Total logs:", receipt.logs.length);

    console.log("\n=== SEARCHING FOR DEPOSIT KEY ===");

    // Look for EventLog2 events
    const eventLog2Topic = ethers.utils.id("EventLog2(address,address,string,bytes32,bytes32,(((address[],address[],address[],address[]),address[]),((uint256[],uint256[],uint256[],uint256[]),uint256[]),((int256[],int256[],int256[],int256[]),int256[]),((bool[],bool[],bool[],bool[]),bool[]),(bytes32[],bytes32[],bytes32[],bytes32[]),(bytes[],bytes[],bytes[],bytes[]),(string[],string[],string[],string[])))");
    const depositCreatedHash = ethers.utils.id("DepositCreated");

    let depositKey;
    let foundInEventLog2 = false;

    // Method 1: EventLog2 with DepositCreated
    for (const log of receipt.logs) {
        if (log.topics[0] === eventLog2Topic && log.topics.length >= 3) {
            console.log("\nFound EventLog2 event");
            console.log("Topics[2]:", log.topics[2]);

            if (log.topics[2] === depositCreatedHash) {
                depositKey = log.topics[1];
                foundInEventLog2 = true;
                console.log("✅ Found deposit key in EventLog2:", depositKey);
                break;
            }
        }
    }

    // Method 2: Look for EventLog1 with DepositCreated
    if (!depositKey) {
        const eventLog1Topic = ethers.utils.id("EventLog1(address,string,bytes32,(((address[],address[],address[],address[]),address[]),((uint256[],uint256[],uint256[],uint256[]),uint256[]),((int256[],int256[],int256[],int256[]),int256[]),((bool[],bool[],bool[],bool[]),bool[]),(bytes32[],bytes32[],bytes32[],bytes32[]),(bytes[],bytes[],bytes[],bytes[]),(string[],string[],string[],string[])))");

        for (const log of receipt.logs) {
            if (log.topics[0] === eventLog1Topic && log.topics.length >= 2) {
                console.log("\nFound EventLog1 event");
                console.log("Topics[1]:", log.topics[1]);

                if (log.topics[1] === depositCreatedHash) {
                    // For EventLog1, the key might be in the data
                    console.log("Found DepositCreated in EventLog1");
                    console.log("Log data length:", log.data.length);

                    // The key is usually the first 32 bytes after the offset
                    if (log.data.length >= 130) { // 0x + 64 chars
                        depositKey = "0x" + log.data.slice(2, 66);
                        console.log("✅ Extracted deposit key from EventLog1 data:", depositKey);
                        break;
                    }
                }
            }
        }
    }

    // Method 3: Direct DepositCreated event
    if (!depositKey) {
        const depositCreatedTopic = ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)");

        for (const log of receipt.logs) {
            if (log.topics[0] === depositCreatedTopic) {
                depositKey = log.topics[1];
                console.log("✅ Found deposit key in DepositCreated event:", depositKey);
                break;
            }
        }
    }

    // Method 4: Any 32-byte value that looks like a key
    if (!depositKey) {
        console.log("\nLooking for any potential deposit key in logs...");

        for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            console.log(`\nLog ${i}:`);
            console.log("Address:", log.address);
            console.log("Topics count:", log.topics.length);

            // Check all topics for potential keys
            for (let j = 1; j < log.topics.length; j++) {
                if (log.topics[j].length === 66) { // 0x + 64 chars
                    console.log(`Topics[${j}]:`, log.topics[j]);

                    // Use the first non-zero 32-byte value as potential key
                    if (log.topics[j] !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
                        depositKey = log.topics[j];
                        console.log("⚠️ Using potential deposit key:", depositKey);
                        break;
                    }
                }
            }
            if (depositKey) break;
        }
    }

    console.log("\n=== RESULT ===");
    if (depositKey) {
        console.log("Deposit key found:", depositKey);

        // Save to file
        const fs = require('fs');
        fs.writeFileSync('correct-deposit-key.txt', depositKey);
        console.log("Saved to correct-deposit-key.txt");

        // Verify if this deposit exists
        const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
        const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

        const accountKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "bytes32"],
                [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
            )
        );

        const account = await dataStore.getAddress(accountKey);
        if (account !== ethers.constants.AddressZero) {
            console.log("\n✅ Deposit verified to exist for account:", account);
        } else {
            console.log("\n⚠️ Could not verify deposit exists with this key");
        }
    } else {
        console.log("❌ Could not find deposit key in transaction logs");
        console.log("The deposit might have been created differently than expected");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });