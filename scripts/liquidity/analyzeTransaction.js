const { ethers } = require("hardhat");

async function main() {
    console.log("=== ANALYZING DEPOSIT TRANSACTION ===\n");

    const txHash = "0xd54bd4249f48c8bca41a2938e7698fb1684f624c8ae1d1e6357e4a09d107b9fb";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);

    console.log("Transaction:", txHash);
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Block:", receipt.blockNumber);
    console.log("Logs count:", receipt.logs.length);

    // Decode logs
    console.log("\n=== LOGS ANALYSIS ===");
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const EVENT_EMITTER = "0xE4fFaF6533F6044Fd4E7e19D60e21e019B14E5f1";

    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`\nLog ${i}:`);
        console.log("  Address:", log.address);

        if (log.address.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
            console.log("  ✅ FROM DEPOSIT HANDLER!");
        } else if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
            console.log("  📢 From EventEmitter");
        }

        if (log.topics.length > 0) {
            console.log("  Event signature:", log.topics[0].slice(0, 10) + "...");
        }

        // Check for deposit key pattern (bytes32 that looks like a key)
        for (let j = 1; j < log.topics.length; j++) {
            if (log.topics[j].startsWith("0x") && log.topics[j].length === 66) {
                console.log(`  Topic[${j}]:`, log.topics[j]);
            }
        }
    }

    // Try to find the deposit key
    console.log("\n=== SEARCHING FOR DEPOSIT KEY ===");
    let possibleKey = null;

    for (const log of receipt.logs) {
        if (log.topics.length > 1) {
            // Often the deposit key is in topics[1] or topics[3]
            const candidate = log.topics[1];
            if (candidate && candidate !== ethers.constants.HashZero) {
                console.log("Checking potential key:", candidate);
                possibleKey = candidate;

                // Check if this key exists in DataStore
                const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
                const accountKey = ethers.utils.keccak256(
                    ethers.utils.solidityPack(
                        ["bytes32", "bytes32"],
                        [candidate, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
                    )
                );

                try {
                    const account = await dataStore.getAddress(accountKey);
                    if (account !== ethers.constants.AddressZero) {
                        console.log("  ✅ This IS a valid deposit key!");
                        console.log("  Account:", account);
                        possibleKey = candidate;
                        break;
                    } else {
                        console.log("  ❌ Not a valid deposit key (no account)");
                    }
                } catch (e) {
                    console.log("  ❌ Not a valid deposit key");
                }
            }
        }
    }

    if (possibleKey) {
        console.log("\n=== DEPOSIT KEY FOUND ===");
        console.log(possibleKey);

        // Check deposit details
        const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
        const receiverKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "bytes32"],
                [possibleKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RECEIVER"))]
            )
        );
        const receiver = await dataStore.getAddress(receiverKey);
        console.log("Receiver:", receiver);

        if (receiver === "0x0000000000000000000000000000000000000001") {
            console.log("✅ Receiver is correctly set to address(1)!");
        }
    } else {
        console.log("\n❌ No valid deposit key found");
        console.log("The deposit was likely not created in DataStore");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });