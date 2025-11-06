const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking mUSD Oracle Provider ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.id("ORACLE_PROVIDER_FOR_TOKEN");
    const providerKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mUSD]
        )
    );

    const provider = await dataStore.getAddress(providerKey);

    console.log("mUSD:", mUSD);
    console.log("Oracle:", ORACLE);
    console.log("Configured Provider:", provider);
    console.log("Is Zero Address:", provider === ethers.constants.AddressZero);
}

main().catch(console.error);
