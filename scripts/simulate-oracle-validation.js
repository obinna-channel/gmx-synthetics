const { ethers } = require("hardhat");

async function main() {
    console.log("=== Simulating Oracle Validation ===\n");

    // Contract addresses
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // First, let's check what oracle configuration is set
    console.log("Step 1: Checking Oracle Configuration...");

    // Check MIN_ORACLE_SIGNERS
    const MIN_ORACLE_SIGNERS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );

    try {
        const minSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS);
        console.log("  MIN_ORACLE_SIGNERS:", minSigners.toString());
    } catch (e) {
        console.log("  Could not read MIN_ORACLE_SIGNERS");
    }

    // Check MAX_ORACLE_SIGNERS
    const MAX_ORACLE_SIGNERS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_ORACLE_SIGNERS"])
    );

    try {
        const maxSigners = await dataStore.getUint(MAX_ORACLE_SIGNERS);
        console.log("  MAX_ORACLE_SIGNERS:", maxSigners.toString());
    } catch (e) {
        console.log("  Could not read MAX_ORACLE_SIGNERS");
    }

    // Check oracle block confirmations
    const MIN_ORACLE_BLOCK_CONFIRMATIONS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_BLOCK_CONFIRMATIONS"])
    );

    try {
        const minConfirmations = await dataStore.getUint(MIN_ORACLE_BLOCK_CONFIRMATIONS);
        console.log("  MIN_ORACLE_BLOCK_CONFIRMATIONS:", minConfirmations.toString());
    } catch (e) {
        console.log("  Could not read MIN_ORACLE_BLOCK_CONFIRMATIONS");
    }

    // Step 2: Try validatePrices with our oracle params
    console.log("\nStep 2: Testing validatePrices...");

    // Test 1: Only sNGN
    console.log("\n  Test 1: Only sNGN in oracle params");
    const oracleParams1 = {
        tokens: [sNGN],
        providers: [oracle.address],
        data: []
    };

    try {
        console.log("    Calling validatePrices...");
        const result = await oracle.validatePrices(oracleParams1, false);
        console.log("    ✅ Validation passed!");
        console.log("    Validated prices count:", result.length);
        for (let i = 0; i < result.length; i++) {
            console.log(`    Price ${i}:`, {
                token: result[i].token,
                min: ethers.utils.formatUnits(result[i].min, 30),
                max: ethers.utils.formatUnits(result[i].max, 30)
            });
        }
    } catch (error) {
        console.log("    ❌ Validation failed:", error.message);
        if (error.data) {
            console.log("    Error data:", error.data);
        }
    }

    // Test 2: Both USDT and sNGN
    console.log("\n  Test 2: Both USDT and sNGN in oracle params");
    const oracleParams2 = {
        tokens: [USDT, sNGN],
        providers: [oracle.address, oracle.address],
        data: []
    };

    try {
        console.log("    Calling validatePrices...");
        const result = await oracle.validatePrices(oracleParams2, false);
        console.log("    ✅ Validation passed!");
        console.log("    Validated prices count:", result.length);
        for (let i = 0; i < result.length; i++) {
            console.log(`    Price ${i}:`, {
                token: result[i].token,
                min: result[i].min.toString(),
                max: result[i].max.toString()
            });
        }
    } catch (error) {
        console.log("    ❌ Validation failed:", error.message);
        if (error.data) {
            console.log("    Error data:", error.data);
        }
    }

    // Test 3: Empty oracle params
    console.log("\n  Test 3: Empty oracle params");
    const oracleParams3 = {
        tokens: [],
        providers: [],
        data: []
    };

    try {
        console.log("    Calling validatePrices...");
        const result = await oracle.validatePrices(oracleParams3, false);
        console.log("    ✅ Validation passed!");
        console.log("    Validated prices count:", result.length);
    } catch (error) {
        console.log("    ❌ Validation failed:", error.message);
        if (error.data) {
            console.log("    Error data:", error.data);
        }
    }

    // Step 3: Check current oracle prices
    console.log("\n\nStep 3: Current Oracle Prices...");

    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT Primary Price:");
        console.log("    Min:", usdtPrice.min.toString());
        console.log("    Max:", usdtPrice.max.toString());
    } catch (e) {
        console.log("  USDT: No primary price set");
    }

    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN Primary Price:");
        console.log("    Min:", ethers.utils.formatUnits(ngnPrice.min, 30));
        console.log("    Max:", ethers.utils.formatUnits(ngnPrice.max, 30));
    } catch (e) {
        console.log("  sNGN: No primary price set");
    }

    // Step 4: Check oracle timestamps
    console.log("\n\nStep 4: Oracle Timestamps...");
    try {
        const minTimestamp = await oracle.minTimestamp();
        const maxTimestamp = await oracle.maxTimestamp();
        console.log("  Min Timestamp:", minTimestamp.toString());
        console.log("  Max Timestamp:", maxTimestamp.toString());

        const currentTime = Math.floor(Date.now() / 1000);
        console.log("  Current Time:", currentTime);

        if (minTimestamp.eq(0) && maxTimestamp.eq(0)) {
            console.log("  ⚠️  Timestamps not set");
        }
    } catch (e) {
        console.log("  Could not read timestamps");
    }

    // Step 5: Try to understand the specific error
    console.log("\n\nStep 5: Analyzing Error 0xf9996e9f...");
    console.log("  Error selector: 0xf9996e9f");
    console.log("  Parameters: [1, 0]");
    console.log("  This could mean:");
    console.log("    - Expected 1 of something but got 0");
    console.log("    - MinOracleSigners(1, 0) - needs 1 signer but got 0");
    console.log("    - Or another validation with expected vs actual values");
}

main().catch(console.error);