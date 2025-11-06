const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking if MockOracleProvider is Enabled ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Calculate the IS_ORACLE_PROVIDER_ENABLED key
    const IS_ORACLE_PROVIDER_ENABLED = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
    );

    const providerEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_ORACLE_PROVIDER_ENABLED, MOCK_PROVIDER]
        )
    );

    console.log("DataStore:", DATA_STORE);
    console.log("MockOracleProvider:", MOCK_PROVIDER);
    console.log("\nIS_ORACLE_PROVIDER_ENABLED constant:", IS_ORACLE_PROVIDER_ENABLED);
    console.log("Provider enabled key:", providerEnabledKey);

    const isEnabled = await dataStore.getBool(providerEnabledKey);

    console.log("\n" + "=".repeat(50));
    if (isEnabled) {
        console.log("✅ MockOracleProvider IS ENABLED");
    } else {
        console.log("❌ MockOracleProvider IS NOT ENABLED");
        console.log("\nTo fix this, run:");
        console.log("  await dataStore.setBool(providerEnabledKey, true);");
    }
    console.log("=".repeat(50));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
