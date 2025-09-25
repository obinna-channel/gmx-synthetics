const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Getting Latest Deposit Key ===\n");
    console.log("Account:", signer.address);
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Get account's deposits
    const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
    );
    
    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ACCOUNT_DEPOSIT_LIST, signer.address]
        )
    );
    
    const depositCount = await dataStore.getBytes32Count(accountKey);
    console.log("Total deposits for account:", depositCount.toString());
    
    if (depositCount.gt(0)) {
        // Get the most recent deposit (last in the array)
        const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, depositCount.sub(1), depositCount);
        const latestDepositKey = depositKeys[0];
        
        console.log("\n🔑 Latest deposit key:", latestDepositKey);
        
        // Check if it's in the active deposit list
        const DEPOSIT_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
        );
        const isActive = await dataStore.containsBytes32(DEPOSIT_LIST, latestDepositKey);
        console.log("Status:", isActive ? "✅ Active (can be executed)" : "❌ Not active (already executed/cancelled)");
        
        // Get current block time to check freshness
        const currentBlock = await ethers.provider.getBlock("latest");
        console.log("\nCurrent block:", currentBlock.number);
        console.log("Current timestamp:", currentBlock.timestamp);
        
        console.log("\n📝 Next step:");
        console.log("Use this key to execute the deposit: execute-deposit-now.js");
        console.log("Make sure to execute within 5 minutes (REQUEST_EXPIRATION_TIME = 300s)");
    } else {
        console.log("\n❌ No deposits found for this account");
    }
}

main().catch(console.error);