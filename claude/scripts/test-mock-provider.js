const { ethers } = require("hardhat");

async function main() {
    console.log("=== Testing Mock Oracle Provider ===\n");

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    // Get contracts
    const provider = await ethers.getContractAt("contracts/oracle/MockOracleProvider.sol:MockOracleProvider", MOCK_PROVIDER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Test 1: Check prices are set
    console.log("📍 Test 1: Checking prices in provider...");
    const usdtPrice = await provider.prices(USDT);
    const sngnPrice = await provider.prices(sNGN);

    console.log("  USDT price (min):", usdtPrice.min.toString());
    console.log("  USDT price (max):", usdtPrice.max.toString());
    console.log("  sNGN price (min):", sngnPrice.min.toString());
    console.log("  sNGN price (max):", sngnPrice.max.toString());

    // Test 2: Check provider is enabled
    console.log("\n📍 Test 2: Checking provider is enabled in DataStore...");

    const IS_ORACLE_PROVIDER_ENABLED = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
    );

    const providerEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_ORACLE_PROVIDER_ENABLED, MOCK_PROVIDER]
        )
    );

    const isEnabled = await dataStore.getBool(providerEnabledKey);
    console.log("  Provider enabled:", isEnabled);
    console.log("  Key used:", providerEnabledKey);

    // Test 3: Call getOraclePrice
    console.log("\n📍 Test 3: Testing getOraclePrice function...");

    try {
        const usdtPriceData = await provider.getOraclePrice(USDT, "0x");
        console.log("  USDT Oracle Price:");
        console.log("    token:", usdtPriceData.token);
        console.log("    min:", usdtPriceData.min.toString());
        console.log("    max:", usdtPriceData.max.toString());
        console.log("    timestamp:", usdtPriceData.timestamp.toString());
        console.log("    provider:", usdtPriceData.provider);
    } catch (e) {
        console.log("  ❌ Failed to get USDT price:", e.message);
    }

    try {
        const sngnPriceData = await provider.getOraclePrice(sNGN, "0x");
        console.log("  sNGN Oracle Price:");
        console.log("    token:", sngnPriceData.token);
        console.log("    min:", sngnPriceData.min.toString());
        console.log("    max:", sngnPriceData.max.toString());
        console.log("    timestamp:", sngnPriceData.timestamp.toString());
        console.log("    provider:", sngnPriceData.provider);
    } catch (e) {
        console.log("  ❌ Failed to get sNGN price:", e.message);
    }

    // Test 4: Check other functions
    console.log("\n📍 Test 4: Testing other provider functions...");
    const shouldAdjust = await provider.shouldAdjustTimestamp();
    const isChainlink = await provider.isChainlinkOnChainProvider();
    console.log("  shouldAdjustTimestamp:", shouldAdjust);
    console.log("  isChainlinkOnChainProvider:", isChainlink);

    console.log("\n✅ Tests complete!");
}

main().catch(console.error);