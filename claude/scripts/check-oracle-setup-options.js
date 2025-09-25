const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Oracle Setup Options ===\n");
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const ORACLE_STORE = ethers.utils.getAddress("0xd873432021cb5e39248cb64f8f3f11fbce973222");
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("📍 Option 1: Check if OracleStore can be used as a provider");
    
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
    console.log("  OracleStore address:", ORACLE_STORE);
    console.log("  Is enabled as provider:", isOracleStoreEnabled);
    
    if (!isOracleStoreEnabled) {
        console.log("\n  💡 We could enable OracleStore as a provider:");
        console.log("     await dataStore.setBool(key, true)");
    }
    
    console.log("\n📍 Option 2: Set OracleStore as provider for our tokens");
    
    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );
    
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    // Check current providers
    const usdtProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, USDT]
        )
    );
    
    const currentUsdtProvider = await dataStore.getAddress(usdtProviderKey);
    console.log("  Current USDT provider:", currentUsdtProvider);
    
    if (currentUsdtProvider === ethers.constants.AddressZero) {
        console.log("\n  💡 We could set OracleStore as USDT provider:");
        console.log("     await dataStore.setAddress(usdtProviderKey, ORACLE_STORE)");
    }
    
    console.log("\n📍 Option 3: Check if we can bypass provider validation");
    
    const MIN_ORACLE_SIGNERS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );
    const minSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS);
    console.log("  MIN_ORACLE_SIGNERS:", minSigners.toString());
    console.log("  ✅ Already set to 0, but this doesn't bypass provider requirements");
    
    console.log("\n🔑 Key Findings:");
    console.log("  1. setPrices requires oracle providers to be configured");
    console.log("  2. setPrimaryPrice doesn't update block numbers/timestamps");
    console.log("  3. We need to either:");
    console.log("     a) Configure OracleStore as a provider and use setPrices");
    console.log("     b) Find why the Oracle has stale block numbers");
    console.log("     c) Deploy a fresh Oracle (would have current block numbers)");
}

main().catch(console.error);