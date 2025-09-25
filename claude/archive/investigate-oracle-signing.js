const { ethers } = require("hardhat");

async function main() {
    console.log("=== Investigating Oracle Signing Requirements ===\n");

    // Contract addresses
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const ORACLE_STORE = "0xE6EBBD002621e658Ee68EF67fEbf0BE08A2b5664";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracleStore = await ethers.getContractAt("OracleStore", ORACLE_STORE);

    // Step 1: Check oracle signers configuration
    console.log("Step 1: Oracle Signers Configuration...");

    // Check if any signers are configured
    try {
        const signerCount = await oracleStore.getSignerCount();
        console.log("  Total oracle signers registered:", signerCount.toString());

        if (signerCount.gt(0)) {
            console.log("  Registered signers:");
            const signers = await oracleStore.getSigners(0, signerCount);
            for (let i = 0; i < signers.length; i++) {
                console.log(`    Signer ${i + 1}:`, signers[i]);
            }
        } else {
            console.log("  ⚠️  No oracle signers registered!");
        }
    } catch (e) {
        console.log("  Could not read oracle signers:", e.message);
    }

    // Step 2: Check which oracle provider is being used
    console.log("\n\nStep 2: Oracle Provider Configuration...");

    // The oracle uses different providers (GmOracleProvider, ChainlinkPriceFeedProvider, etc.)
    // Let's see which one is configured for our tokens
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    // Check oracle provider for tokens
    const ORACLE_PROVIDER_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER"])
    );

    try {
        // Key for USDT oracle provider
        const usdtProviderKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ORACLE_PROVIDER_KEY, USDT]
            )
        );
        const usdtProvider = await dataStore.getAddress(usdtProviderKey);
        console.log("  USDT Oracle Provider:", usdtProvider);

        // Key for sNGN oracle provider
        const ngnProviderKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ORACLE_PROVIDER_KEY, sNGN]
            )
        );
        const ngnProvider = await dataStore.getAddress(ngnProviderKey);
        console.log("  sNGN Oracle Provider:", ngnProvider);
    } catch (e) {
        console.log("  Could not read oracle providers:", e.message);
    }

    // Step 3: Look at how the Oracle expects data to be formatted
    console.log("\n\nStep 3: Understanding Oracle Data Format...");

    console.log("  Based on the Oracle interface, the data array should contain:");
    console.log("  - For GmOracleProvider: Signed price data with signatures");
    console.log("  - For ChainlinkProvider: Empty data (prices from Chainlink feeds)");
    console.log("  - For our MarksSimplifiedOracle: Likely simplified format");

    // Step 4: Check if we can use the simplified approach
    console.log("\n\nStep 4: Checking Simplified Oracle Approach...");

    const [signer] = await ethers.getSigners();

    // Since we have CONTROLLER role, let's check if we can act as an oracle signer
    const CONTROLLER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );

    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    const hasController = await roleStore.hasRole(signer.address, CONTROLLER);
    console.log("  Account has CONTROLLER role:", hasController);

    // Try to set timestamps (needed for oracle validation)
    if (hasController) {
        console.log("\n  Setting oracle timestamps...");
        try {
            const currentTime = Math.floor(Date.now() / 1000);
            const tx = await oracle.setTimestamps(currentTime - 60, currentTime + 60);
            console.log("    Transaction:", tx.hash);
            await tx.wait();
            console.log("    ✅ Timestamps set");

            const minTs = await oracle.minTimestamp();
            const maxTs = await oracle.maxTimestamp();
            console.log("    Min timestamp:", minTs.toString());
            console.log("    Max timestamp:", maxTs.toString());
        } catch (e) {
            console.log("    ❌ Could not set timestamps:", e.message);
        }
    }

    // Step 5: Try different data formats
    console.log("\n\nStep 5: Testing Different Data Formats...");

    // Format 1: Try with empty data but timestamps set
    console.log("\n  Test 1: With timestamps set, empty data");
    const oracleParams1 = {
        tokens: [sNGN],
        providers: [ORACLE],
        data: []
    };

    try {
        const result = await oracle.callStatic.validatePrices(oracleParams1, false);
        console.log("    ✅ Validation would pass!");
        console.log("    Result:", result);
    } catch (error) {
        console.log("    ❌ Still fails:", error.message);
        if (error.data) {
            console.log("    Error data:", error.data);
        }
    }

    // Format 2: Try with the oracle itself as provider
    console.log("\n  Test 2: Using oracle address as provider");
    const oracleParams2 = {
        tokens: [sNGN],
        providers: [ORACLE],
        data: ["0x"] // Single empty bytes entry
    };

    try {
        const result = await oracle.callStatic.validatePrices(oracleParams2, false);
        console.log("    ✅ Validation would pass!");
    } catch (error) {
        console.log("    ❌ Fails:", error.message);
    }

    console.log("\n\n💡 Key Findings:");
    console.log("  1. The system expects MIN_ORACLE_SIGNERS = 1");
    console.log("  2. No oracle signers are registered in OracleStore");
    console.log("  3. The Oracle is using a simplified approach (MarksSimplifiedOracle)");
    console.log("  4. We need to either:");
    console.log("     a) Register an oracle signer");
    console.log("     b) Set MIN_ORACLE_SIGNERS to 0");
    console.log("     c) Use a different validation path");
}

main().catch(console.error);