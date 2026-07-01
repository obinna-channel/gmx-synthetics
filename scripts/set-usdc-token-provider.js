const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting USDC Oracle Provider ===\n");
    console.log("Signer:", signer.address);

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const USDC = "0xe73B11Fb1e3eeEe8AF2a23079A4410Fe1B370548";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("Oracle:", ORACLE);
    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("USDC:", USDC);

    // Calculate the ORACLE_PROVIDER_FOR_TOKEN constant
    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );
    console.log("\nORACLE_PROVIDER_FOR_TOKEN constant:", ORACLE_PROVIDER_FOR_TOKEN);

    // Set provider for USDC
    console.log("\n📍 Setting provider for USDC...");
    const usdcProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, USDC]
        )
    );
    console.log("  Key:", usdcProviderKey);

    try {
        // Check current provider
        const currentUsdcProvider = await dataStore.getAddress(usdcProviderKey);
        console.log("  Current provider:", currentUsdcProvider);

        if (currentUsdcProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase()) {
            console.log("  ✅ Already set to mock provider");
        } else {
            // Set the provider
            const tx = await dataStore.setAddress(usdcProviderKey, MOCK_PROVIDER);
            await tx.wait();
            console.log("  ✅ Set to mock provider");
            console.log("  TX:", tx.hash);

            // Verify
            const newUsdcProvider = await dataStore.getAddress(usdcProviderKey);
            console.log("  Verification:", newUsdcProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "SUCCESS ✅" : "FAILED ❌");
        }
    } catch (error) {
        console.log("  ❌ Failed to set USDC provider:", error.message);
    }

    console.log("\n✅ USDC token provider configuration complete!");
    console.log("\n🎯 Next step: Run create-first-deposit-usdtngn-usdc.js");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
