const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Oracle Provider Configuration ===\n");
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    // Convert to proper checksum
    const ORACLE = ethers.utils.getAddress("0x8cb1b934b197990ed6dbb0b5fc9940d893c33d60".toLowerCase());
    const ORACLE_STORE = "0xD873432021Cb5e39248Cb64F8f3F11FBCE973222";
    
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check if there are any configured oracle providers for our tokens
    console.log("Checking oracle providers for tokens:\n");
    
    // Key format: keccak256(abi.encode("ORACLE_PROVIDER_FOR_TOKEN", oracle, token))
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
    console.log("USDT Oracle Provider:", usdtProvider);
    
    // Check sNGN provider
    const sngnProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, sNGN]
        )
    );
    const sngnProvider = await dataStore.getAddress(sngnProviderKey);
    console.log("sNGN Oracle Provider:", sngnProvider);
    
    // Check if OracleStore is configured as a provider
    console.log("\nOracleStore address:", ORACLE_STORE);
    
    // Check if OracleStore is enabled as a provider
    const IS_ORACLE_PROVIDER_ENABLED = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
    );
    const oracleStoreEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_ORACLE_PROVIDER_ENABLED, ORACLE_STORE]
        )
    );
    const isOracleStoreEnabled = await dataStore.getBool(oracleStoreEnabledKey);
    console.log("Is OracleStore enabled as provider:", isOracleStoreEnabled);
    
    // Check current oracle prices
    console.log("\n📊 Current Oracle Prices:");
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    
    try {
        const usdtPrice = await oracle.primaryPrices(USDT);
        console.log("USDT price:", usdtPrice);
    } catch (e) {
        console.log("USDT price: Not set or error reading");
    }
    
    try {
        const sngnPrice = await oracle.primaryPrices(sNGN);
        console.log("sNGN price:", sngnPrice);
    } catch (e) {
        console.log("sNGN price: Not set or error reading");
    }
    
    console.log("\n💡 Findings:");
    if (usdtProvider === ethers.constants.AddressZero && sngnProvider === ethers.constants.AddressZero) {
        console.log("❌ No oracle providers configured for USDT or sNGN");
        console.log("\nRecommended approach:");
        console.log("1. Use Oracle.setPrimaryPrice() directly (you have CONTROLLER role)");
        console.log("2. Set prices for USDT and sNGN");
        console.log("3. Execute deposit with empty SetPricesParams");
    } else {
        console.log("✅ Oracle providers are configured");
        console.log("You can use these providers in SetPricesParams");
    }
}

main().catch(console.error);