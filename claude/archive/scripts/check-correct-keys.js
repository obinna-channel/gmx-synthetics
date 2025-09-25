const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING WITH CORRECT KEY FORMATS ===\n");

    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Try both key formats
    console.log("Testing key formats for MARKET_TOKEN:");
    
    // Format 1: string concatenation (what we used to set)
    const stringKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["MARKET_TOKEN", MARKET])
    );
    const valueWithString = await dataStore.getAddress(stringKey);
    console.log("With string 'MARKET_TOKEN':", valueWithString);
    
    // Format 2: bytes32 id (what the contract might expect)
    const bytes32Key = ethers.utils.keccak256(
        ethers.utils.solidityPack(["bytes32", "address"], 
        [ethers.utils.id("MARKET_TOKEN"), MARKET])
    );
    const valueWithBytes32 = await dataStore.getAddress(bytes32Key);
    console.log("With bytes32 id('MARKET_TOKEN'):", valueWithBytes32);
    
    // Check WNT with both formats
    console.log("\nTesting key formats for WNT:");
    
    const wntStringKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WNT"));
    const wntString = await dataStore.getAddress(wntStringKey);
    console.log("With keccak256('WNT'):", wntString);
    
    const wntBytes32Key = ethers.utils.id("WNT");
    const wntBytes32 = await dataStore.getAddress(wntBytes32Key);
    console.log("With id('WNT'):", wntBytes32);
    
    // The WNT key should just be the hash of "WNT"
    console.log("\nWNT key should be:", ethers.utils.id("WNT"));
}

main().catch(console.error);
