const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING HISTORICAL DEPOSIT ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    console.log("Checking deposit key from 'successful' creation:");
    console.log("Key:", depositKey);
    console.log("Transaction: 0xbd62a9a987b00e82a9f13a7230fbc5f24c9ef681b70bc48012c5bb4575d1d316");
    console.log("Block: 196488385\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check if this deposit exists
    const properties = [
        "ACCOUNT", "RECEIVER", "CALLBACK_CONTRACT", "MARKET",
        "INITIAL_LONG_TOKEN", "INITIAL_SHORT_TOKEN",
        "INITIAL_LONG_TOKEN_AMOUNT", "INITIAL_SHORT_TOKEN_AMOUNT",
        "MIN_MARKET_TOKENS", "UPDATED_AT_BLOCK", "EXECUTION_FEE"
    ];

    let depositFound = false;

    for (const prop of properties) {
        const storageKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "bytes32"],
                [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(prop))]
            )
        );

        try {
            // Try as address
            if (["ACCOUNT", "RECEIVER", "CALLBACK_CONTRACT", "MARKET", "INITIAL_LONG_TOKEN", "INITIAL_SHORT_TOKEN"].includes(prop)) {
                const value = await dataStore.getAddress(storageKey);
                if (value !== ethers.constants.AddressZero) {
                    console.log(`${prop}: ${value}`);
                    depositFound = true;
                }
            } else {
                // Try as uint
                const value = await dataStore.getUint(storageKey);
                if (value.gt(0) || prop === "MIN_MARKET_TOKENS" || prop === "EXECUTION_FEE") {
                    if (prop.includes("AMOUNT")) {
                        console.log(`${prop}: ${ethers.utils.formatUnits(value, 6)} USDT`);
                    } else {
                        console.log(`${prop}: ${value.toString()}`);
                    }
                    if (value.gt(0)) depositFound = true;
                }
            }
        } catch (e) {
            // Skip
        }
    }

    if (!depositFound) {
        console.log("❌ This 'successful' deposit DOES NOT exist in DataStore!");
        console.log("\nThis means the deposit was never actually created,");
        console.log("even though the transaction succeeded.\n");
    } else {
        console.log("\n✅ Deposit exists in DataStore!");
    }

    // Let's also check the deposit list
    console.log("=== CHECKING DEPOSIT LIST ===");

    // Try different potential keys for deposit list
    const depositListKeys = [
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEPOSIT_LIST")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("depositList")),
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEPOSITS")),
    ];

    for (const key of depositListKeys) {
        try {
            const length = await dataStore.getUint(key);
            if (length.gt(0)) {
                console.log(`Found deposit list with key ${key.slice(0,10)}...`);
                console.log(`Length: ${length.toString()}`);

                // Try to get first deposit
                const firstDepositKey = ethers.utils.keccak256(
                    ethers.utils.solidityPack(["bytes32", "uint256"], [key, 0])
                );
                const firstDeposit = await dataStore.getBytes32(firstDepositKey);
                if (firstDeposit !== ethers.constants.HashZero) {
                    console.log(`First deposit: ${firstDeposit}`);
                }
            }
        } catch (e) {
            // Skip
        }
    }

    // Check nonce
    const nonceKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("NONCE"));
    const nonce = await dataStore.getUint(nonceKey);
    console.log(`\nCurrent nonce: ${nonce.toString()}`);

    // Check if DataStore itself might be the issue
    console.log("\n=== CHECKING DATASTORE FUNCTIONALITY ===");

    // Try to read a known value
    const wntKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WNT"));
    const wnt = await dataStore.getAddress(wntKey);
    console.log("WNT address from DataStore:", wnt);

    if (wnt === ethers.constants.AddressZero) {
        console.log("⚠️ Even WNT is not set - DataStore might be reset or wrong!");
    } else {
        console.log("✅ DataStore can read values correctly");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });