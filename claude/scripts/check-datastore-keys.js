const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking DataStore Keys for Deposit ===\n");

    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("Deposit key:", depositKey);

    // Let me try different key constructions
    console.log("\n📍 Method 1: Using nested hashes (what I was using):");

    // Base DEPOSIT hash
    const DEPOSIT_HASH = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT"])
    );
    console.log("DEPOSIT hash:", DEPOSIT_HASH);

    // Account key - hash(DEPOSIT_HASH, depositKey)
    const accountKey1 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [DEPOSIT_HASH, depositKey]
        )
    );
    const account1 = await dataStore.getAddress(accountKey1);
    console.log("Account (method 1):", account1);

    console.log("\n📍 Method 2: Using direct string concatenation:");

    // Try with ACCOUNT suffix
    const ACCOUNT_HASH = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"])
    );
    const accountKey2 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "bytes32"],
            [DEPOSIT_HASH, depositKey, ACCOUNT_HASH]
        )
    );
    const account2 = await dataStore.getAddress(accountKey2);
    console.log("Account (method 2):", account2);

    console.log("\n📍 Method 3: Checking different field names:");

    // List of possible field names to check
    const fields = [
        "ACCOUNT",
        "RECEIVER",
        "USER",
        "INITIAL_LONG_TOKEN",
        "INITIAL_SHORT_TOKEN",
        "LONG_TOKEN",
        "SHORT_TOKEN"
    ];

    for (const field of fields) {
        const fieldHash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], [field])
        );
        const key = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "bytes32", "bytes32"],
                [DEPOSIT_HASH, depositKey, fieldHash]
            )
        );

        // Try as address
        try {
            const value = await dataStore.getAddress(key);
            if (value !== ethers.constants.AddressZero) {
                console.log(`  ${field}:`, value);
            }
        } catch {}

        // Try as uint
        try {
            const value = await dataStore.getUint(key);
            if (value.gt(0)) {
                console.log(`  ${field} (uint):`, value.toString());
            }
        } catch {}
    }

    console.log("\n📍 Method 4: Check the actual long/short amounts:");

    // INITIAL_LONG_TOKEN_AMOUNT
    const LONG_AMOUNT_HASH = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_LONG_TOKEN_AMOUNT"])
    );
    const longAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "bytes32"],
            [DEPOSIT_HASH, depositKey, LONG_AMOUNT_HASH]
        )
    );
    const longAmount = await dataStore.getUint(longAmountKey);
    console.log("Long token amount:", longAmount.toString());
    if (longAmount.gt(0)) {
        console.log("  = ", ethers.utils.formatUnits(longAmount, 6), "USDT");
    }

    // INITIAL_SHORT_TOKEN_AMOUNT
    const SHORT_AMOUNT_HASH = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_SHORT_TOKEN_AMOUNT"])
    );
    const shortAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "bytes32"],
            [DEPOSIT_HASH, depositKey, SHORT_AMOUNT_HASH]
        )
    );
    const shortAmount = await dataStore.getUint(shortAmountKey);
    console.log("Short token amount:", shortAmount.toString());

    // Let's also check if maybe the deposit key itself is stored differently
    console.log("\n📍 Checking raw storage at deposit key:");

    // Try reading the deposit key directly as different types
    const directAddress = await dataStore.getAddress(depositKey);
    const directUint = await dataStore.getUint(depositKey);
    const directBytes32 = await dataStore.getBytes32(depositKey);

    console.log("Direct address read:", directAddress);
    console.log("Direct uint read:", directUint.toString());
    console.log("Direct bytes32 read:", directBytes32);
}

main().catch(console.error);