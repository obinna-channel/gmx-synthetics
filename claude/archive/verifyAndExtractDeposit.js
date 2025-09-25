const { ethers } = require("hardhat");

async function main() {
    console.log("=== VERIFYING DEPOSIT AND EXTRACTING KEY ===\n");

    const txHash = "0x4aa1f5a2c58e943051b77bd4dd4fabc7f222832780e67f36f70b5b0607191234";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);

    console.log("Transaction:", txHash);
    console.log("Block:", receipt.blockNumber);
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Look for deposit key in logs
    console.log("\n=== ANALYZING LOGS ===");
    console.log("Total logs:", receipt.logs.length);

    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    let depositKey = null;

    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];

        // Check if from DepositHandler
        if (log.address.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
            console.log(`\n✅ Log ${i} from DepositHandler!`);
            if (log.topics.length > 1) {
                depositKey = log.topics[1];
                console.log("Potential deposit key:", depositKey);
            }
        }

        // Also check for any bytes32 that could be a key
        if (log.topics.length > 1 && log.topics[1].length === 66) {
            console.log(`\nLog ${i} from ${log.address.slice(0, 10)}...`);
            console.log("  Topic[1]:", log.topics[1]);

            // If we haven't found a key from DepositHandler, use this
            if (!depositKey) {
                depositKey = log.topics[1];
            }
        }
    }

    if (!depositKey) {
        console.log("\n⚠️ No deposit key found in logs");
        return;
    }

    console.log("\n=== CHECKING DEPOSIT IN DATASTORE ===");
    console.log("Deposit key:", depositKey);

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check key deposit properties
    const properties = [
        { name: "ACCOUNT", key: "ACCOUNT" },
        { name: "RECEIVER", key: "RECEIVER" },
        { name: "MARKET", key: "MARKET" },
        { name: "INITIAL_LONG_TOKEN", key: "INITIAL_LONG_TOKEN" },
        { name: "INITIAL_SHORT_TOKEN", key: "INITIAL_SHORT_TOKEN" },
        { name: "INITIAL_LONG_TOKEN_AMOUNT", key: "INITIAL_LONG_TOKEN_AMOUNT" },
        { name: "INITIAL_SHORT_TOKEN_AMOUNT", key: "INITIAL_SHORT_TOKEN_AMOUNT" },
        { name: "MIN_MARKET_TOKENS", key: "MIN_MARKET_TOKENS" },
        { name: "UPDATED_AT_BLOCK", key: "UPDATED_AT_BLOCK" },
        { name: "EXECUTION_FEE", key: "EXECUTION_FEE" }
    ];

    let depositExists = false;

    for (const prop of properties) {
        const storageKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "bytes32"],
                [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(prop.key))]
            )
        );

        try {
            if (["ACCOUNT", "RECEIVER", "MARKET", "INITIAL_LONG_TOKEN", "INITIAL_SHORT_TOKEN"].includes(prop.name)) {
                const value = await dataStore.getAddress(storageKey);
                if (value !== ethers.constants.AddressZero) {
                    console.log(`${prop.name}: ${value}`);
                    depositExists = true;

                    if (prop.name === "RECEIVER" && value === "0x0000000000000000000000000000000000000001") {
                        console.log("  ✅ Receiver is correctly set to address(1)!");
                    }
                }
            } else {
                const value = await dataStore.getUint(storageKey);
                if (value.gt(0)) {
                    if (prop.name.includes("AMOUNT")) {
                        console.log(`${prop.name}: ${ethers.utils.formatUnits(value, 6)} USDT`);
                    } else if (prop.name === "EXECUTION_FEE") {
                        console.log(`${prop.name}: ${ethers.utils.formatEther(value)} ETH`);
                    } else {
                        console.log(`${prop.name}: ${value.toString()}`);
                    }
                    depositExists = true;
                }
            }
        } catch (error) {
            // Skip
        }
    }

    console.log("\n=== RESULT ===");
    if (depositExists) {
        console.log("🎉 DEPOSIT EXISTS IN DATASTORE!");
        console.log("\nDeposit key for execution:");
        console.log(depositKey);

        // Save to file for easy access
        const fs = require('fs');
        fs.writeFileSync('deposit-key.txt', depositKey);
        console.log("\nKey saved to deposit-key.txt");
    } else {
        console.log("❌ Deposit not found in DataStore");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });