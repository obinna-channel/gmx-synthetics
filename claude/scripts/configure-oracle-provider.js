const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Configuring OracleStore as Provider ===\n");
    console.log("Signer:", signer.address);
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const ORACLE_STORE = ethers.utils.getAddress("0xd873432021cb5e39248cb64f8f3f11fbce973222");
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("📍 Step 1: Enable OracleStore as a provider");
    
    const IS_ORACLE_PROVIDER_ENABLED = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["IS_ORACLE_PROVIDER_ENABLED"])
    );
    
    const oracleStoreEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [IS_ORACLE_PROVIDER_ENABLED, ORACLE_STORE]
        )
    );
    
    const isEnabled = await dataStore.getBool(oracleStoreEnabledKey);
    console.log("  Current status:", isEnabled ? "✅ Enabled" : "❌ Not enabled");
    
    if (!isEnabled) {
        console.log("  Enabling OracleStore as provider...");
        const tx1 = await dataStore.setBool(oracleStoreEnabledKey, true);
        console.log("  TX:", tx1.hash);
        await tx1.wait();
        console.log("  ✅ OracleStore enabled as provider");
    }
    
    console.log("\n📍 Step 2: Set OracleStore as provider for USDT and sNGN");
    
    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );
    
    // Set for USDT
    const usdtProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, USDT]
        )
    );
    
    const currentUsdtProvider = await dataStore.getAddress(usdtProviderKey);
    console.log("  USDT current provider:", currentUsdtProvider);
    
    if (currentUsdtProvider !== ORACLE_STORE) {
        console.log("  Setting OracleStore as USDT provider...");
        const tx2 = await dataStore.setAddress(usdtProviderKey, ORACLE_STORE);
        console.log("  TX:", tx2.hash);
        await tx2.wait();
        console.log("  ✅ OracleStore set as USDT provider");
    }
    
    // Set for sNGN
    const sngnProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, sNGN]
        )
    );
    
    const currentSngnProvider = await dataStore.getAddress(sngnProviderKey);
    console.log("  sNGN current provider:", currentSngnProvider);
    
    if (currentSngnProvider !== ORACLE_STORE) {
        console.log("  Setting OracleStore as sNGN provider...");
        const tx3 = await dataStore.setAddress(sngnProviderKey, ORACLE_STORE);
        console.log("  TX:", tx3.hash);
        await tx3.wait();
        console.log("  ✅ OracleStore set as sNGN provider");
    }
    
    console.log("\n✅ SUCCESS! OracleStore is now configured as provider for both tokens");
    console.log("\n📝 Next steps:");
    console.log("  1. Store prices in OracleStore (if needed)");
    console.log("  2. Use oracle.setPrices() with OracleStore as provider");
    console.log("  3. This will update block numbers and timestamps properly");
}

main().catch(console.error);