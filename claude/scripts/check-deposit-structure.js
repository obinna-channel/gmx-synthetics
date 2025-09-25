const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Structure ===\n");
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Get deposit details from DataStore
    console.log("Deposit key:", depositKey);
    
    // Check the deposit's token configuration
    // The deposit is stored as a struct in DataStore
    
    // Get account (who created it)
    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "string"],
            [depositKey, ethers.constants.HashZero, "account"]
        )
    );
    
    try {
        const account = await dataStore.getAddress(accountKey);
        console.log("Account:", account);
    } catch (e) {
        console.log("Could not read account");
    }
    
    // Based on your previous deployment, let's try with empty oracle params
    console.log("\n💡 Key difference from previous deployment:");
    console.log("Previous: Used empty oracle params (no tokens, providers, data)");
    console.log("Current: We're passing tokens and encoded price data");
    console.log("\nLet's try with EMPTY oracle params like the previous deployment.");
}

main().catch(console.error);