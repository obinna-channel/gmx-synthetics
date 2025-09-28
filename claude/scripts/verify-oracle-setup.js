const { ethers } = require("hardhat");

async function main() {
    console.log("=== Verifying Oracle Provider Setup ===\n");

    // Contract addresses
    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827";

    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Get contract instances
    const dataStore = await ethers.getContractAt("DataStore", DATASTORE);
    const mockProvider = await ethers.getContractAt("contracts/oracle/MockOracleProvider.sol:MockOracleProvider", MOCK_PROVIDER);

    console.log("📍 Step 1: Check if MockOracleProvider is enabled in DataStore");
    console.log("=====================================");

    // Check if provider is enabled
    const IS_ORACLE_PROVIDER_ENABLED = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
    );

    const providerEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_ORACLE_PROVIDER_ENABLED, MOCK_PROVIDER]
        )
    );

    const isProviderEnabled = await dataStore.getBool(providerEnabledKey);
    console.log(`Provider ${MOCK_PROVIDER}`);
    console.log(`Enabled: ${isProviderEnabled ? "✅ YES" : "❌ NO"}`);

    if (!isProviderEnabled) {
        console.log("\n⚠️  WARNING: Provider is not enabled! Need to enable it first.");
    }

    console.log("\n📍 Step 2: Check token-provider mappings");
    console.log("=====================================");

    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );

    // Check USDT provider
    const usdtProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, USDT]
        )
    );
    const usdtProvider = await dataStore.getAddress(usdtProviderKey);
    console.log("\nUSDT Token Provider:");
    console.log(`  Token: ${USDT}`);
    console.log(`  Expected Provider: ${MOCK_PROVIDER}`);
    console.log(`  Actual Provider: ${usdtProvider}`);
    console.log(`  Match: ${usdtProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅ YES" : "❌ NO"}`);

    // Check sNGN provider
    const sngnProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, sNGN]
        )
    );
    const sngnProvider = await dataStore.getAddress(sngnProviderKey);
    console.log("\nsNGN Token Provider:");
    console.log(`  Token: ${sNGN}`);
    console.log(`  Expected Provider: ${MOCK_PROVIDER}`);
    console.log(`  Actual Provider: ${sngnProvider}`);
    console.log(`  Match: ${sngnProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅ YES" : "❌ NO"}`);

    // Check mNGN provider
    const mngnProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mNGN]
        )
    );
    const mngnProvider = await dataStore.getAddress(mngnProviderKey);
    console.log("\nmNGN Token Provider:");
    console.log(`  Token: ${mNGN}`);
    console.log(`  Expected Provider: ${MOCK_PROVIDER}`);
    console.log(`  Actual Provider: ${mngnProvider}`);
    console.log(`  Match: ${mngnProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅ YES" : "❌ NO"}`);

    console.log("\n📍 Step 3: Check prices in MockOracleProvider");
    console.log("=====================================");

    try {
        // Get USDT price
        const usdtOraclePrice = await mockProvider.getOraclePrice(USDT, "0x");
        console.log("\nUSDT Price:");
        console.log(`  Min: ${usdtOraclePrice.min.toString()}`);
        console.log(`  Max: ${usdtOraclePrice.max.toString()}`);
        console.log(`  Human readable (÷10^24): ${ethers.utils.formatUnits(usdtOraclePrice.min, 24)}`);

        // Get sNGN price
        const sngnOraclePrice = await mockProvider.getOraclePrice(sNGN, "0x");
        console.log("\nsNGN Price:");
        console.log(`  Min: ${sngnOraclePrice.min.toString()}`);
        console.log(`  Max: ${sngnOraclePrice.max.toString()}`);
        console.log(`  Human readable (÷10^12): ${ethers.utils.formatUnits(sngnOraclePrice.min, 12)}`);

        // Get mNGN price
        const mngnOraclePrice = await mockProvider.getOraclePrice(mNGN, "0x");
        console.log("\nmNGN Price:");
        console.log(`  Min: ${mngnOraclePrice.min.toString()}`);
        console.log(`  Max: ${mngnOraclePrice.max.toString()}`);
        console.log(`  Human readable (÷10^12): ${ethers.utils.formatUnits(mngnOraclePrice.min, 12)}`);
    } catch (error) {
        console.log("\n❌ Error getting prices:", error.message);
        if (error.message.includes("price not set")) {
            console.log("   Some token prices are not set in the MockOracleProvider");
        }
    }

    console.log("\n📍 Step 4: Summary");
    console.log("=====================================");

    const allChecksPass =
        isProviderEnabled &&
        usdtProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() &&
        sngnProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() &&
        mngnProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase();

    if (allChecksPass) {
        console.log("✅ Oracle provider is properly configured!");
        console.log("\n🎯 Current Price Configuration:");
        console.log("  USDT: 1500 (1 USDT = 1500 NGN)");
        console.log("  sNGN: 1 (1 sNGN = 1 NGN)");
        console.log("  mNGN: 1 (1 mNGN = 1 NGN)");
    } else {
        console.log("❌ Oracle provider setup is incomplete!");
        console.log("\n🔧 To fix:");
        if (!isProviderEnabled) {
            console.log("  1. Enable the provider in DataStore (need CONTROLLER role)");
        }
        if (usdtProvider.toLowerCase() !== MOCK_PROVIDER.toLowerCase()) {
            console.log("  2. Set USDT token provider mapping");
        }
        if (sngnProvider.toLowerCase() !== MOCK_PROVIDER.toLowerCase()) {
            console.log("  3. Set sNGN token provider mapping");
        }
        if (mngnProvider.toLowerCase() !== MOCK_PROVIDER.toLowerCase()) {
            console.log("  4. Set mNGN token provider mapping");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });