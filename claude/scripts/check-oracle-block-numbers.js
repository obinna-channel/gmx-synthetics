const { ethers } = require("hardhat");

async function main() {
    console.log("=== Oracle Block Number Investigation ===\n");

    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const ORACLE_STORE = "0xBc2408eF555c05A471A8242ef640061910EA4FD0";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    // Token addresses
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get current block info
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("📊 Current Chain State:");
    console.log("  Block Number:", currentBlock.number);
    console.log("  Block Timestamp:", currentBlock.timestamp);
    console.log("  Timestamp (Human):", new Date(currentBlock.timestamp * 1000).toISOString());

    console.log("\n📍 Oracle Configuration:");

    // Check MIN_ORACLE_SIGNERS
    try {
        // The key for MIN_ORACLE_SIGNERS is keccak256("MIN_ORACLE_SIGNERS")
        const MIN_ORACLE_SIGNERS_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MIN_ORACLE_SIGNERS"));
        const minSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
        console.log("  MIN_ORACLE_SIGNERS:", minSigners.toString());
    } catch (e) {
        console.log("  MIN_ORACLE_SIGNERS: Error reading", e.message);
    }

    // Check MIN_ORACLE_BLOCK_CONFIRMATIONS
    try {
        const MIN_ORACLE_BLOCK_CONFIRMATIONS_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MIN_ORACLE_BLOCK_CONFIRMATIONS"));
        const minConfirmations = await dataStore.getUint(MIN_ORACLE_BLOCK_CONFIRMATIONS_KEY);
        console.log("  MIN_ORACLE_BLOCK_CONFIRMATIONS:", minConfirmations.toString());
    } catch (e) {
        console.log("  MIN_ORACLE_BLOCK_CONFIRMATIONS: Error reading", e.message);
    }

    // Check MAX_ORACLE_PRICE_AGE
    try {
        const MAX_ORACLE_PRICE_AGE_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_ORACLE_PRICE_AGE"));
        const maxAge = await dataStore.getUint(MAX_ORACLE_PRICE_AGE_KEY);
        console.log("  MAX_ORACLE_PRICE_AGE:", maxAge.toString(), "seconds");
    } catch (e) {
        console.log("  MAX_ORACLE_PRICE_AGE: Error reading", e.message);
    }

    // Check MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR
    try {
        const MAX_REF_PRICE_DEVIATION_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR"));
        const maxDeviation = await dataStore.getUint(MAX_REF_PRICE_DEVIATION_KEY);
        console.log("  MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR:", maxDeviation.toString());
    } catch (e) {
        console.log("  MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR: Error reading", e.message);
    }

    console.log("\n🔍 Checking Oracle Prices and Block Info:");

    // Try to get primary prices for tokens
    const tokens = [
        { address: USDT, name: "USDT" },
        { address: sNGN, name: "sNGN" },
        { address: WETH, name: "WETH" }
    ];

    for (const token of tokens) {
        console.log(`\n  ${token.name} (${token.address}):`);

        try {
            // Get primary price
            const primaryPrice = await oracle.primaryPrices(token.address);
            if (primaryPrice && primaryPrice.min) {
                console.log(`    Primary Price Min: ${primaryPrice.min.toString()}`);
                console.log(`    Primary Price Max: ${primaryPrice.max.toString()}`);
            } else {
                console.log("    Primary Price: Not set");
            }
        } catch (e) {
            console.log("    Primary Price: Error reading", e.message);
        }
    }

    // Check if Oracle has any functions to get block numbers
    console.log("\n🔎 Checking Oracle Timestamps:");

    try {
        // Try to get min and max timestamps
        const minTimestamp = await oracle.minTimestamp();
        const maxTimestamp = await oracle.maxTimestamp();

        console.log("  Min Timestamp:", minTimestamp.toString());
        console.log("  Min Timestamp (Human):", new Date(minTimestamp.toNumber() * 1000).toISOString());
        console.log("  Max Timestamp:", maxTimestamp.toString());
        console.log("  Max Timestamp (Human):", new Date(maxTimestamp.toNumber() * 1000).toISOString());

        const timeDiff = maxTimestamp.sub(minTimestamp);
        console.log("  Time Window:", timeDiff.toString(), "seconds");
    } catch (e) {
        console.log("  Timestamps: Could not read -", e.message);
    }

    // Decode the error from the previous transaction
    console.log("\n📋 Previous Error Analysis:");
    console.log("  Error Code: 0xd84b8ee8 (OracleBlockNumbersAreSmallerThanRequired)");

    // The error data from the previous transaction
    const errorData = "0xd84b8ee80000000000000000000000000000000000000000000000000000000068d32bdd0000000000000000000000000000000000000000000000000000000068d319a7000000000000000000000000000000000000000000000000000000000000012c";

    if (errorData.startsWith("0xd84b8ee8")) {
        // Decode the error parameters
        const decoded = ethers.utils.defaultAbiCoder.decode(
            ["uint256", "uint256", "uint256"],
            "0x" + errorData.slice(10) // Remove the error signature
        );

        console.log("  Oracle Block Number (from error):", decoded[0].toString());
        console.log("  Required Min Block Number:", decoded[1].toString());
        console.log("  Block Difference:", decoded[2].toString());

        // These look like timestamps, not block numbers
        console.log("\n  🤔 Analysis: These values look like timestamps!");
        console.log("    Oracle 'Block' as timestamp:", new Date(decoded[0].toNumber() * 1000).toISOString());
        console.log("    Required 'Block' as timestamp:", new Date(decoded[1].toNumber() * 1000).toISOString());
    }

    // Try to understand the Oracle's internal state
    console.log("\n💡 Oracle State Investigation:");

    // Check if there's a tokensWithPrices array or similar
    try {
        const tokensWithPricesCount = await oracle.tokensWithPricesCount();
        console.log("  Tokens with prices count:", tokensWithPricesCount.toString());

        if (tokensWithPricesCount.gt(0)) {
            console.log("  Tokens with prices:");
            for (let i = 0; i < tokensWithPricesCount.toNumber(); i++) {
                const token = await oracle.tokensWithPrices(i);
                console.log(`    [${i}]: ${token}`);
            }
        }
    } catch (e) {
        // This function might not exist
    }

    // Check OracleStore for signer info
    try {
        const oracleStore = await ethers.getContractAt("OracleStore", ORACLE_STORE);

        console.log("\n📝 OracleStore Signer Info:");

        // Get signer count
        const signerCount = await oracleStore.getSignerCount();
        console.log("  Total Signers:", signerCount.toString());

        if (signerCount.gt(0)) {
            console.log("  Signers:");
            for (let i = 0; i < Math.min(signerCount.toNumber(), 5); i++) {
                const signer = await oracleStore.getSigner(i);
                console.log(`    [${i}]: ${signer}`);
            }
        }
    } catch (e) {
        console.log("  OracleStore: Error reading -", e.message);
    }

    console.log("\n✅ Investigation complete!");
    console.log("\n📌 Key Finding: The 'OracleBlockNumbersAreSmallerThanRequired' error");
    console.log("   is likely using timestamps, not actual block numbers!");
    console.log("   The values in the error (0x68d32bdd = 1758668765) are Unix timestamps.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });