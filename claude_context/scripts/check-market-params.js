const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING MARKET CONFIGURATION ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check if create deposit is disabled
    const createDisabledKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["CREATE_DEPOSIT_FEATURE_DISABLED", MARKET])
    );
    const createDisabled = await dataStore.getBool(createDisabledKey);
    console.log("Create deposit disabled:", createDisabled);
    
    // Check market salt
    const saltKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["MARKET_SALT", MARKET])
    );
    const salt = await dataStore.getBytes32(saltKey);
    console.log("Market salt:", salt);
    
    // Check if market token is set correctly
    const marketTokenKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["MARKET_TOKEN", MARKET])
    );
    const marketToken = await dataStore.getAddress(marketTokenKey);
    console.log("Market token stored:", marketToken);
    console.log("Expected (market address):", MARKET);
    console.log("Match:", marketToken.toLowerCase() === MARKET.toLowerCase());
    
    if (salt === ethers.constants.HashZero) {
        console.log("\n⚠️  Market salt not set - setting it now...");
        
        // Generate a salt
        const newSalt = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("USDTNGN_MARKET"));
        
        try {
            const tx = await dataStore.setBytes32(saltKey, newSalt);
            await tx.wait();
            console.log("✅ Salt set:", newSalt);
        } catch (e) {
            console.log("Error setting salt:", e.message);
        }
    }
}

main().catch(console.error);
