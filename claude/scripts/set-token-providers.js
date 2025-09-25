const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting Token Oracle Providers ===\n");
    console.log("Signer:", signer.address);

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("Oracle:", ORACLE);
    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("USDT:", USDT);
    console.log("sNGN:", sNGN);

    // Calculate the ORACLE_PROVIDER_FOR_TOKEN constant
    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );
    console.log("\nORACLE_PROVIDER_FOR_TOKEN constant:", ORACLE_PROVIDER_FOR_TOKEN);

    // Set provider for USDT
    console.log("\n📍 Setting provider for USDT...");
    const usdtProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, USDT]
        )
    );
    console.log("  Key:", usdtProviderKey);

    try {
        // Check current provider
        const currentUsdtProvider = await dataStore.getAddress(usdtProviderKey);
        console.log("  Current provider:", currentUsdtProvider);

        if (currentUsdtProvider === MOCK_PROVIDER) {
            console.log("  ✅ Already set to mock provider");
        } else {
            // Set the provider
            const tx1 = await dataStore.setAddress(usdtProviderKey, MOCK_PROVIDER);
            await tx1.wait();
            console.log("  ✅ Set to mock provider");

            // Verify
            const newUsdtProvider = await dataStore.getAddress(usdtProviderKey);
            console.log("  Verification:", newUsdtProvider === MOCK_PROVIDER ? "SUCCESS" : "FAILED");
        }
    } catch (error) {
        console.log("  ❌ Failed to set USDT provider:", error.message);
    }

    // Set provider for sNGN
    console.log("\n📍 Setting provider for sNGN...");
    const sngnProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, sNGN]
        )
    );
    console.log("  Key:", sngnProviderKey);

    try {
        // Check current provider
        const currentSngnProvider = await dataStore.getAddress(sngnProviderKey);
        console.log("  Current provider:", currentSngnProvider);

        if (currentSngnProvider === MOCK_PROVIDER) {
            console.log("  ✅ Already set to mock provider");
        } else {
            // Set the provider
            const tx2 = await dataStore.setAddress(sngnProviderKey, MOCK_PROVIDER);
            await tx2.wait();
            console.log("  ✅ Set to mock provider");

            // Verify
            const newSngnProvider = await dataStore.getAddress(sngnProviderKey);
            console.log("  Verification:", newSngnProvider === MOCK_PROVIDER ? "SUCCESS" : "FAILED");
        }
    } catch (error) {
        console.log("  ❌ Failed to set sNGN provider:", error.message);
    }

    console.log("\n✅ Token provider configuration complete!");
    console.log("\n🎯 Next step: Run execute-with-mock-provider.js again");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });