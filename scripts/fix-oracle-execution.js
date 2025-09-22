const { ethers } = require("hardhat");

async function main() {
    console.log("=== Fixing Oracle for Deposit Execution ===\n");

    const [signer] = await ethers.getSigners();

    // Contract addresses
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Option 1: Set MIN_ORACLE_SIGNERS to 0
    console.log("Option 1: Set MIN_ORACLE_SIGNERS to 0...");

    const MIN_ORACLE_SIGNERS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );

    try {
        const currentMinSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
        console.log("  Current MIN_ORACLE_SIGNERS:", currentMinSigners.toString());

        if (currentMinSigners.gt(0)) {
            console.log("  Setting to 0...");
            const tx = await dataStore.setUint(MIN_ORACLE_SIGNERS_KEY, 0);
            console.log("  Transaction:", tx.hash);
            await tx.wait();

            const newMinSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
            console.log("  New MIN_ORACLE_SIGNERS:", newMinSigners.toString());
        }
    } catch (e) {
        console.log("  ❌ Could not set MIN_ORACLE_SIGNERS:", e.message);
    }

    // Option 2: Register the Oracle itself as a provider for our tokens
    console.log("\n\nOption 2: Register Oracle as Provider...");

    // First, enable the Oracle as a provider
    const IS_ORACLE_PROVIDER_ENABLED_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
    );

    const oracleProviderEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_ORACLE_PROVIDER_ENABLED_KEY, ORACLE]
        )
    );

    try {
        console.log("  Enabling Oracle as provider...");
        const tx1 = await dataStore.setBool(oracleProviderEnabledKey, true);
        await tx1.wait();
        console.log("  ✅ Oracle enabled as provider");

        // Set Oracle as the provider for USDT
        const ORACLE_PROVIDER_FOR_TOKEN_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
        );

        const usdtProviderKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [ORACLE_PROVIDER_FOR_TOKEN_KEY, ORACLE, USDT]
            )
        );

        const tx2 = await dataStore.setAddress(usdtProviderKey, ORACLE);
        await tx2.wait();
        console.log("  ✅ Oracle set as USDT provider");

        // Set Oracle as the provider for sNGN
        const ngnProviderKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [ORACLE_PROVIDER_FOR_TOKEN_KEY, ORACLE, sNGN]
            )
        );

        const tx3 = await dataStore.setAddress(ngnProviderKey, ORACLE);
        await tx3.wait();
        console.log("  ✅ Oracle set as sNGN provider");

    } catch (e) {
        console.log("  ❌ Could not register provider:", e.message);
    }

    // Option 3: Create a custom provider contract
    console.log("\n\nOption 3: Deploy Custom Provider...");
    console.log("  This would require deploying a contract that implements IOracleProvider");
    console.log("  The provider would return the prices we've set with setPrimaryPrice");

    // Test if empty oracle params work now
    console.log("\n\nTesting Empty Oracle Params...");

    const emptyOracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    try {
        const result = await oracle.callStatic.validatePrices(emptyOracleParams, false);
        console.log("  ✅ Empty params validation passes!");
        console.log("  This means we can execute deposits without providing prices in params");
    } catch (error) {
        console.log("  ❌ Empty params still fail:", error.message);
    }

    // Summary
    console.log("\n\n=== Summary ===");
    console.log("The issue is that the Oracle expects:");
    console.log("1. Each token in params needs a registered provider");
    console.log("2. The provider must be enabled in DataStore");
    console.log("3. The provider must implement IOracleProvider interface");
    console.log("\nPossible solutions:");
    console.log("1. Use empty oracle params (tokens=[], providers=[], data=[])");
    console.log("2. Deploy a custom IOracleProvider that returns our set prices");
    console.log("3. Modify the Oracle contract to support a simplified mode");
}

main().catch(console.error);