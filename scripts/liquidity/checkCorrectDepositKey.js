const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING CORRECT DEPOSIT KEY ===\n");

    // The key from EventEmitter log
    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    console.log("Checking deposit key:", depositKey);

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check deposit properties
    const properties = [
        { name: "ACCOUNT", key: "ACCOUNT", type: "address" },
        { name: "RECEIVER", key: "RECEIVER", type: "address" },
        { name: "CALLBACK_CONTRACT", key: "CALLBACK_CONTRACT", type: "address" },
        { name: "MARKET", key: "MARKET", type: "address" },
        { name: "INITIAL_LONG_TOKEN", key: "INITIAL_LONG_TOKEN", type: "address" },
        { name: "INITIAL_SHORT_TOKEN", key: "INITIAL_SHORT_TOKEN", type: "address" },
        { name: "INITIAL_LONG_TOKEN_AMOUNT", key: "INITIAL_LONG_TOKEN_AMOUNT", type: "uint" },
        { name: "INITIAL_SHORT_TOKEN_AMOUNT", key: "INITIAL_SHORT_TOKEN_AMOUNT", type: "uint" },
        { name: "MIN_MARKET_TOKENS", key: "MIN_MARKET_TOKENS", type: "uint" },
        { name: "UPDATED_AT_BLOCK", key: "UPDATED_AT_BLOCK", type: "uint" },
        { name: "EXECUTION_FEE", key: "EXECUTION_FEE", type: "uint" }
    ];

    console.log("\n=== DEPOSIT PROPERTIES ===");
    let depositExists = false;

    for (const prop of properties) {
        const storageKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "bytes32"],
                [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(prop.key))]
            )
        );

        try {
            if (prop.type === "address") {
                const value = await dataStore.getAddress(storageKey);
                if (value !== ethers.constants.AddressZero) {
                    console.log(`${prop.name}: ${value}`);
                    depositExists = true;

                    if (prop.name === "RECEIVER") {
                        if (value === "0x0000000000000000000000000000000000000001") {
                            console.log("  ✅ Receiver is correctly set to address(1)!");
                        } else {
                            console.log("  ⚠️ Receiver is NOT address(1)");
                        }
                    }
                }
            } else {
                const value = await dataStore.getUint(storageKey);
                if (value.gt(0) || prop.name === "MIN_MARKET_TOKENS" || prop.name === "EXECUTION_FEE") {
                    if (prop.name.includes("AMOUNT")) {
                        console.log(`${prop.name}: ${ethers.utils.formatUnits(value, 6)} USDT`);
                    } else if (prop.name === "EXECUTION_FEE") {
                        console.log(`${prop.name}: ${ethers.utils.formatEther(value)} ETH`);
                    } else {
                        console.log(`${prop.name}: ${value.toString()}`);
                    }
                    if (value.gt(0)) {
                        depositExists = true;
                    }
                }
            }
        } catch (error) {
            console.log(`Error reading ${prop.name}:`, error.message);
        }
    }

    console.log("\n=== RESULT ===");
    if (depositExists) {
        console.log("🎉 DEPOSIT EXISTS IN DATASTORE!");
        console.log("\nDeposit key:");
        console.log(depositKey);
        console.log("\nThis deposit is ready to be executed by a keeper.");

        // Save to file
        const fs = require('fs');
        fs.writeFileSync('deposit-key.txt', depositKey);
        console.log("\nKey saved to deposit-key.txt");
    } else {
        console.log("❌ No deposit found with this key");
        console.log("The deposit may not have been created properly.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });