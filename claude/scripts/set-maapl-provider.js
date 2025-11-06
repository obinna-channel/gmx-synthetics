const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting mAAPL Oracle Provider ===\n");
    console.log("Signer:", signer.address);

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mAAPL = "0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("Oracle:", ORACLE);
    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mAAPL:", mAAPL);

    // Calculate the ORACLE_PROVIDER_FOR_TOKEN constant
    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );
    console.log("\nORACLE_PROVIDER_FOR_TOKEN constant:", ORACLE_PROVIDER_FOR_TOKEN);

    // Set provider for mAAPL
    console.log("\n📍 Setting provider for mAAPL...");
    const maaplProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mAAPL]
        )
    );
    console.log("  Key:", maaplProviderKey);

    try {
        // Check current provider
        const currentProvider = await dataStore.getAddress(maaplProviderKey);
        console.log("  Current provider:", currentProvider);

        if (currentProvider === MOCK_PROVIDER) {
            console.log("  ✅ Already set to mock provider");
        } else {
            // Set the provider
            const tx = await dataStore.setAddress(maaplProviderKey, MOCK_PROVIDER);
            await tx.wait();
            console.log("  ✅ Set to mock provider");
            console.log("  Transaction:", tx.hash);

            // Verify
            const newProvider = await dataStore.getAddress(maaplProviderKey);
            console.log("  Verification:", newProvider === MOCK_PROVIDER ? "SUCCESS" : "FAILED");
        }
    } catch (error) {
        console.log("  ❌ Failed to set mAAPL provider:", error.message);
    }

    console.log("\n✅ mAAPL provider configuration complete!");
    console.log("\n🎯 Next step: Run set-maapl-price.js to set the price");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
