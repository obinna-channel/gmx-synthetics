const { ethers } = require("hardhat");

async function main() {
    console.log("=== Configuring Oracle Settings ===\n");

    const [signer] = await ethers.getSigners();
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const ORACLE_STORE = "0xcA051377254B642bE843DeD131de48206db63f94";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracleStore = await ethers.getContractAt("OracleStore", ORACLE_STORE);

    // Calculate key hashes using the CORRECT method
    function hashString(str) {
        return ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], [str])
        );
    }

    // Oracle configuration keys
    const configs = [
        { key: "MIN_ORACLE_BLOCK_CONFIRMATIONS", value: 255, type: "uint" },
        { key: "MAX_ORACLE_PRICE_AGE", value: 86400, type: "uint" }, // 24 hours
        { key: "MAX_ORACLE_TIMESTAMP_RANGE", value: 3600, type: "uint" }, // 1 hour
        { key: "MIN_ORACLE_SIGNERS", value: 1, type: "uint" },
    ];

    console.log("Setting Oracle configuration values in DataStore...\n");

    for (const config of configs) {
        const keyHash = hashString(config.key);

        try {
            // Check current value
            const currentValue = await dataStore.getUint(keyHash);
            console.log(config.key + ":");
            console.log("  Current: " + currentValue.toString());

            if (currentValue.toString() !== config.value.toString()) {
                console.log("  Setting to: " + config.value);
                const tx = await dataStore.setUint(keyHash, config.value);
                await tx.wait();
                console.log("  ✅ Set successfully");
            } else {
                console.log("  ✅ Already set to " + config.value);
            }
        } catch (error) {
            console.log("  ❌ Error: " + error.message);
        }
        console.log("");
    }

    // Now add oracle signer
    console.log("\n=== Adding Oracle Signer ===\n");

    const existingSignersCount = await oracleStore.getSignerCount();
    console.log("Current signer count:", existingSignersCount.toString());

    if (existingSignersCount == 0) {
        console.log("Adding your address as oracle signer...");
        try {
            const tx = await oracleStore.addSigner(signer.address);
            console.log("Transaction sent:", tx.hash);
            await tx.wait();
            console.log("✅ Oracle signer added!");

            const newSignerCount = await oracleStore.getSignerCount();
            console.log("New signer count:", newSignerCount.toString());
        } catch (error) {
            console.log("❌ Error adding signer:", error.message);
        }
    } else {
        const signers = await oracleStore.getSigners(0, existingSignersCount);
        console.log("Existing signers:", signers);
        if (signers.includes(signer.address)) {
            console.log("✅ Your address is already an oracle signer");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error.message);
        process.exit(1);
    });