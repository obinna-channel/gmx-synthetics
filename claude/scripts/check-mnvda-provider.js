const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking mNVDA Oracle Provider ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const mNVDA = "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.id("ORACLE_PROVIDER_FOR_TOKEN");
    const providerKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mNVDA]
        )
    );

    const provider = await dataStore.getAddress(providerKey);

    console.log("mNVDA:", mNVDA);
    console.log("Oracle:", ORACLE);
    console.log("Configured Provider:", provider);
    console.log("Is Zero Address:", provider === ethers.constants.AddressZero);
    console.log("Expected (MockProvider):", "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5");
    console.log("Match:", provider.toLowerCase() === "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5".toLowerCase() ? "✅" : "❌");
}

main().catch(console.error);
