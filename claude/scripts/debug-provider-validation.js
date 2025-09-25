const { ethers } = require("hardhat");

async function main() {
    console.log("=== Debugging Oracle Provider Validation ===\n");

    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("📍 Checking how Keys.isOracleProviderEnabledKey works...\n");

    // Method 1: Our current calculation
    const IS_ORACLE_PROVIDER_ENABLED = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
    );
    console.log("IS_ORACLE_PROVIDER_ENABLED constant:", IS_ORACLE_PROVIDER_ENABLED);

    const ourKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_ORACLE_PROVIDER_ENABLED, MOCK_PROVIDER]
        )
    );
    console.log("Our calculated key:", ourKey);

    // Check if it's enabled with our key
    const isEnabledOurKey = await dataStore.getBool(ourKey);
    console.log("Is enabled with our key:", isEnabledOurKey);

    // Let's also try reading the Keys contract directly if deployed
    console.log("\n📍 Trying to read Keys contract if available...");

    try {
        // Try to get Keys library address (it might be a library, not a contract)
        const Keys = await ethers.getContractFactory("Keys");
        console.log("Keys factory loaded");

        // Since Keys is a library with pure functions, we can call them directly
        // But we need to deploy a test contract that uses it
    } catch (e) {
        console.log("Keys is a library, not a deployed contract");
    }

    // Let's check what error we get when we try to execute
    console.log("\n📍 Decoding the error from execute attempt...");
    const errorData = "0x68b49e6c0000000000000000000000005d85d4acd35ffd0dad76c5eb0da3d7e53e20ccc5000000000000000000000000d873432021cb5e39248cb64f8f3f11fbce973222";

    console.log("Error selector:", errorData.slice(0, 10));
    console.log("First address (our provider):", "0x" + errorData.slice(34, 74));
    console.log("Second address (unknown):", "0x" + errorData.slice(98, 138));

    // Check if the second address has any significance
    const mysteryAddress = "0xd873432021cb5e39248cb64f8f3f11fbce973222";
    console.log("\n📍 Investigating mystery address:", mysteryAddress);

    // Check if it's a provider for the token
    const mysteryKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_ORACLE_PROVIDER_ENABLED, mysteryAddress]
        )
    );
    const isMysteryEnabled = await dataStore.getBool(mysteryKey);
    console.log("Is mystery address an enabled provider:", isMysteryEnabled);

    // Check if there's a default provider set for tokens
    console.log("\n📍 Checking for token-specific provider settings...");

    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    // Try different key patterns that might store token-provider mappings
    const patterns = [
        // Pattern: ORACLE_PROVIDER_FOR_TOKEN + token
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["string", "address"],
                ["ORACLE_PROVIDER_FOR_TOKEN", USDT]
            )
        ),
        // Pattern: token + ORACLE_PROVIDER
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "string"],
                [USDT, "ORACLE_PROVIDER"]
            )
        ),
        // Pattern: PRICE_FEED + token
        ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["string", "address"],
                ["PRICE_FEED", USDT]
            )
        )
    ];

    for (let i = 0; i < patterns.length; i++) {
        const value = await dataStore.getAddress(patterns[i]);
        if (value !== ethers.constants.AddressZero) {
            console.log(`Pattern ${i} returned:`, value);
        }
    }

    console.log("\n✅ Debug complete!");
}

main().catch(console.error);