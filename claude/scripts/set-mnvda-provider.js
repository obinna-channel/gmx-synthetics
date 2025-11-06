const { ethers } = require("hardhat");

async function main() {
    console.log("=== Setting Oracle Provider for mNVDA ===\n");

    // Contract addresses
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mNVDA = "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325";

    // Get DataStore contract
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Calculate the key for oracle provider
    // IMPORTANT: Must use defaultAbiCoder.encode, NOT ethers.utils.id()
    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );
    const providerKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mNVDA]
        )
    );

    console.log("Setting oracle provider...");
    console.log("  Token: mNVDA");
    console.log("  Address:", mNVDA);
    console.log("  Provider: MockOracleProvider");
    console.log("  Provider Address:", MOCK_PROVIDER);

    const tx = await dataStore.setAddress(providerKey, MOCK_PROVIDER);
    await tx.wait();

    console.log("\n✅ Oracle provider set successfully!");
    console.log("Transaction hash:", tx.hash);

    // Verify
    const setProvider = await dataStore.getAddress(providerKey);
    console.log("\n📍 Verification:");
    console.log("  Provider set to:", setProvider);
    console.log("  Expected:", MOCK_PROVIDER);
    console.log("  Match:", setProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅" : "❌");
}

main().catch(console.error);
