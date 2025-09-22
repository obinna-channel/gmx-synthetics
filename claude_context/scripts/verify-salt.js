const { ethers } = require("hardhat");

async function main() {
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // The correct key format for market salt
    const correctSaltKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"], 
            [ethers.utils.id("MARKET_SALT"), MARKET]
        )
    );
    
    console.log("Checking different salt key formats:");
    
    // What we set before
    const oldKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address"], ["MARKET_SALT", MARKET])
    );
    
    const salt1 = await dataStore.getBytes32(correctSaltKey);
    const salt2 = await dataStore.getBytes32(oldKey);
    
    console.log("Salt with bytes32 key:", salt1);
    console.log("Salt with string key:", salt2);
    
    if (salt2 !== ethers.constants.HashZero && salt1 === ethers.constants.HashZero) {
        console.log("\nWe set the salt with wrong key format! Setting with correct key...");
        const tx = await dataStore.setBytes32(correctSaltKey, salt2);
        await tx.wait();
        console.log("✓ Salt set with correct key");
    }
}

main().catch(console.error);
