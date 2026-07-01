const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    console.log("=== CHECKING CURRENT PROVIDER CONFIGURATION ===\n");

    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";

    const newProvider = fs.readFileSync('./keeper/new_mock_provider_address.txt', 'utf8').trim();
    const oldProvider = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    const mPKR = "0xDC7e9F5a3D337161880d084131BC16214f2F8EBD";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    const dataStore = await ethers.getContractAt("DataStore", DATASTORE);

    console.log("Contract addresses:");
    console.log("  Old provider:", oldProvider);
    console.log("  New provider:", newProvider);
    console.log("  mPKR token:  ", mPKR);
    console.log("  mUSD token:  ", mUSD);
    console.log();

    // Check what provider is configured for mPKR
    const mPKRKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ethers.utils.id("ORACLE_PROVIDER_FOR_TOKEN"), ORACLE, mPKR]
        )
    );
    const mPKRProvider = await dataStore.getAddress(mPKRKey);

    // Check what provider is configured for mUSD
    const mUSDKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ethers.utils.id("ORACLE_PROVIDER_FOR_TOKEN"), ORACLE, mUSD]
        )
    );
    const mUSDProvider = await dataStore.getAddress(mUSDKey);

    // Check if both providers are enabled
    const oldProviderEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.id("IS_ORACLE_PROVIDER_ENABLED"), oldProvider]
        )
    );
    const newProviderEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ethers.utils.id("IS_ORACLE_PROVIDER_ENABLED"), newProvider]
        )
    );

    const oldProviderEnabled = await dataStore.getBool(oldProviderEnabledKey);
    const newProviderEnabled = await dataStore.getBool(newProviderEnabledKey);

    console.log("Provider Status:");
    console.log("  Old provider enabled:", oldProviderEnabled ? "✅ YES" : "❌ NO");
    console.log("  New provider enabled:", newProviderEnabled ? "✅ YES" : "❌ NO");
    console.log();

    console.log("Token Configuration:");
    console.log("  mPKR provider:", mPKRProvider);
    console.log("    Matches old:", mPKRProvider.toLowerCase() === oldProvider.toLowerCase() ? "✅ YES" : "❌ NO");
    console.log("    Matches new:", mPKRProvider.toLowerCase() === newProvider.toLowerCase() ? "✅ YES" : "❌ NO");
    console.log();
    console.log("  mUSD provider:", mUSDProvider);
    console.log("    Matches old:", mUSDProvider.toLowerCase() === oldProvider.toLowerCase() ? "✅ YES" : "❌ NO");
    console.log("    Matches new:", mUSDProvider.toLowerCase() === newProvider.toLowerCase() ? "✅ YES" : "❌ NO");
}

main().catch(console.error);
