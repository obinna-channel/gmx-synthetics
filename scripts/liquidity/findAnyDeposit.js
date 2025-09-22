const { ethers } = require("hardhat");

async function main() {
    console.log("=== SEARCHING FOR ANY EXISTING DEPOSITS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // The key that keeps appearing
    const knownKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    // Try different possible keys
    const keysToCheck = [
        knownKey,
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEPOSIT_LIST")),
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [0])),
    ];

    console.log("Checking known deposit keys...\n");

    for (const depositKey of keysToCheck) {
        console.log(`Checking key: ${depositKey.slice(0, 10)}...`);

        // Check for ACCOUNT property
        const accountKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "bytes32"],
                [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
            )
        );

        try {
            const account = await dataStore.getAddress(accountKey);
            if (account !== ethers.constants.AddressZero) {
                console.log(`  ✅ FOUND DEPOSIT!`);
                console.log(`  Account: ${account}`);

                // Get more details
                const receiverKey = ethers.utils.keccak256(
                    ethers.utils.solidityPack(
                        ["bytes32", "bytes32"],
                        [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RECEIVER"))]
                    )
                );
                const receiver = await dataStore.getAddress(receiverKey);
                console.log(`  Receiver: ${receiver}`);

                const marketKey = ethers.utils.keccak256(
                    ethers.utils.solidityPack(
                        ["bytes32", "bytes32"],
                        [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET"))]
                    )
                );
                const market = await dataStore.getAddress(marketKey);
                console.log(`  Market: ${market}`);

                console.log(`\n  Full deposit key: ${depositKey}`);
                return depositKey;
            }
        } catch (e) {
            // Skip
        }
    }

    console.log("\n❌ No deposits found in DataStore");

    // Let's also check the deposit list length
    console.log("\n=== CHECKING DEPOSIT LIST ===");
    const depositListKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEPOSIT_LIST"));
    try {
        const length = await dataStore.getUint(depositListKey);
        console.log("Deposit list length:", length.toString());
    } catch (e) {
        console.log("Could not read deposit list length");
    }

    // Check if there's a nonce counter
    const nonceKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("NONCE"));
    try {
        const nonce = await dataStore.getUint(nonceKey);
        console.log("Current nonce:", nonce.toString());
    } catch (e) {
        console.log("Could not read nonce");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });