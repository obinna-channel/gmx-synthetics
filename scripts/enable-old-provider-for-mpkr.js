const { ethers } = require("hardhat");

async function main() {
    console.log("=== ENABLING OLD PROVIDER FOR mPKR ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Configuring with account:", signer.address);

    // Addresses
    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";

    const oldProvider = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mPKR = "0xDC7e9F5a3D337161880d084131BC16214f2F8EBD";

    console.log("Old MockOracleProvider:", oldProvider);
    console.log("mPKR token:            ", mPKR);
    console.log();

    // Check CONTROLLER role
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    const CONTROLLER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    const hasController = await roleStore.hasRole(signer.address, CONTROLLER);

    if (!hasController) {
        throw new Error("❌ Signer needs CONTROLLER role to update DataStore");
    }
    console.log("✅ Signer has CONTROLLER role\n");

    // Get DataStore contract
    const dataStore = await ethers.getContractAt("DataStore", DATASTORE);

    // Step 1: Enable old provider globally
    console.log("Step 1: Enabling old provider globally...");
    const isProviderEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.id("IS_ORACLE_PROVIDER_ENABLED"), oldProvider]
        )
    );

    const tx1 = await dataStore.setBool(isProviderEnabledKey, true);
    await tx1.wait();
    console.log("   ✅ Old provider enabled globally\n");

    // Step 2: Set old provider for mPKR token
    console.log("Step 2: Setting old provider for mPKR token...");

    const providerKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [
                ethers.utils.id("ORACLE_PROVIDER_FOR_TOKEN"),
                ORACLE,
                mPKR
            ]
        )
    );

    const tx2 = await dataStore.setAddress(providerKey, oldProvider);
    await tx2.wait();
    console.log("   ✅ Set old provider for mPKR");

    console.log("\n🎉 Old provider re-enabled for mPKR!");

    // Verification
    console.log("\n📋 Verification:");
    const isEnabled = await dataStore.getBool(isProviderEnabledKey);
    console.log("   Old provider globally enabled:", isEnabled ? "✅ YES" : "❌ NO");

    const configuredProvider = await dataStore.getAddress(providerKey);
    console.log("   Provider for mPKR:", configuredProvider);
    console.log("   Matches old provider:", configuredProvider.toLowerCase() === oldProvider.toLowerCase() ? "✅ YES" : "❌ NO");

    console.log("\n📝 Note:");
    console.log("   - Both old and new providers are now enabled globally");
    console.log("   - mPKR is now using the old provider");
    console.log("   - Can investigate the mystery separately");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
