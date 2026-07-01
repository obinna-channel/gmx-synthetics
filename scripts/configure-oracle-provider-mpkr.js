const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("=== CONFIGURING ORACLE PROVIDER FOR mPKR ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Configuring with account:", signer.address);

    // Addresses
    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";

    // Read new provider address
    const newProviderAddress = fs.readFileSync('./keeper/new_mock_provider_address.txt', 'utf8').trim();
    console.log("New MockOracleProvider:", newProviderAddress);
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

    // Step 1: Enable new provider (only need to do this once)
    console.log("Step 1: Enabling new provider globally...");
    const isProviderEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.id("IS_ORACLE_PROVIDER_ENABLED"), newProviderAddress]
        )
    );

    const tx1 = await dataStore.setBool(isProviderEnabledKey, true);
    await tx1.wait();
    console.log("   ✅ Provider enabled globally\n");

    // Step 2: Set provider for mPKR token only
    console.log("Step 2: Setting provider for mPKR token...");

    const mPKR = "0xDC7e9F5a3D337161880d084131BC16214f2F8EBD";

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

    const tx2 = await dataStore.setAddress(providerKey, newProviderAddress);
    await tx2.wait();
    console.log("   ✅ Set provider for mPKR");

    console.log("\n🎉 DataStore configuration complete for mPKR!");

    // Verification
    console.log("\n📋 Verification:");
    const isEnabled = await dataStore.getBool(isProviderEnabledKey);
    console.log("   Provider globally enabled:", isEnabled ? "✅ YES" : "❌ NO");

    const configuredProvider = await dataStore.getAddress(providerKey);
    console.log("   Provider for mPKR:", configuredProvider);
    console.log("   Matches new provider:", configuredProvider.toLowerCase() === newProviderAddress.toLowerCase() ? "✅ YES" : "❌ NO");

    console.log("\n📝 Next steps:");
    console.log("1. Identify keeper wallets");
    console.log("2. Assign keeper roles in RoleStore");
    console.log("3. Authorize keeper wallets as price updaters");
    console.log("4. Test with mPKR market");
    console.log("5. Roll out to remaining markets if successful");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
