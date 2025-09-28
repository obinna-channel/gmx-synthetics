const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Oracle Setup for Market 1 ===\n");

    // Contract addresses
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check if provider is enabled
    console.log("📍 Checking if MockProvider is enabled...");
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
    console.log(`  Provider enabled: ${isEnabled ? "✅ YES" : "❌ NO"}`);

    // Check token-provider mappings
    console.log("\n📍 Checking token-provider mappings...");
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
    console.log(`  USDT provider: ${usdtProvider}`);
    console.log(`    Expected: ${MOCK_PROVIDER}`);
    console.log(`    Match: ${usdtProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅" : "❌"}`);

    // Check sNGN provider
    const sngnProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, sNGN]
        )
    );
    const sngnProvider = await dataStore.getAddress(sngnProviderKey);
    console.log(`\n  sNGN provider: ${sngnProvider}`);
    console.log(`    Expected: ${MOCK_PROVIDER}`);
    console.log(`    Match: ${sngnProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅" : "❌"}`);

    // Check prices in MockProvider
    console.log("\n📍 Checking MockProvider prices...");
    const mockProvider = await ethers.getContractAt(
        [
            {
                "inputs": [{"name": "token", "type": "address"}],
                "name": "prices",
                "outputs": [
                    {"name": "min", "type": "uint256"},
                    {"name": "max", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ],
        MOCK_PROVIDER
    );

    try {
        const usdtPrice = await mockProvider.prices(USDT);
        console.log(`  USDT price:`);
        console.log(`    Min: ${usdtPrice.min.toString()}`);
        console.log(`    Max: ${usdtPrice.max.toString()}`);
        const usdtRate = usdtPrice.min.div(ethers.BigNumber.from(10).pow(24));
        console.log(`    Rate: ${usdtRate.toString()} NGN`);
    } catch (e) {
        console.log(`  USDT price: ❌ Not set`);
    }

    try {
        const sngnPrice = await mockProvider.prices(sNGN);
        console.log(`\n  sNGN price:`);
        console.log(`    Min: ${sngnPrice.min.toString()}`);
        console.log(`    Max: ${sngnPrice.max.toString()}`);
        const sngnRate = sngnPrice.min.div(ethers.BigNumber.from(10).pow(12));
        console.log(`    Rate: ${sngnRate.toString()} NGN`);
    } catch (e) {
        console.log(`  sNGN price: ❌ Not set`);
    }

    // Summary
    console.log("\n=== Summary ===");
    if (isEnabled &&
        usdtProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() &&
        sngnProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase()) {
        console.log("✅ Oracle setup looks correct!");
        console.log("\nIf deposit still failing, check:");
        console.log("  - Market configuration matches token order");
        console.log("  - Prices are set correctly for the market type");
    } else {
        console.log("❌ Oracle setup needs configuration!");
        if (!isEnabled) {
            console.log("  - Enable the MockProvider");
        }
        if (usdtProvider.toLowerCase() !== MOCK_PROVIDER.toLowerCase()) {
            console.log("  - Set USDT provider mapping");
        }
        if (sngnProvider.toLowerCase() !== MOCK_PROVIDER.toLowerCase()) {
            console.log("  - Set sNGN provider mapping");
        }
    }
}

main().catch(console.error);