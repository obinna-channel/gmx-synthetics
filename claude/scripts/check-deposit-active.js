const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking If Deposit Is Active ===\n");
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("Deposit key:", depositKey);
    
    // Check DEPOSIT_LIST (global list of active deposits)
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    
    const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
    console.log("\nTotal active deposits globally:", depositCount.toString());
    
    if (depositCount.gt(0)) {
        const deposits = await dataStore.getBytes32ValuesAt(DEPOSIT_LIST, 0, depositCount);
        console.log("Active deposit keys:");
        for (let i = 0; i < deposits.length; i++) {
            console.log(`  ${i + 1}. ${deposits[i]}`);
            if (deposits[i] === depositKey) {
                console.log("     ✅ OUR DEPOSIT IS ACTIVE!");
            }
        }
    }
    
    // Also check the DEPOSIT data
    const DEPOSIT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT"])
    );
    const depositDataKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [DEPOSIT, depositKey]
        )
    );
    
    const depositAddresses = await dataStore.getAddressArray(depositDataKey);
    
    if (depositAddresses.length > 0) {
        console.log("\n✅ DEPOSIT IS ACTIVE AND WAITING FOR EXECUTION!");
        console.log("Details:");
        console.log("  Account:", depositAddresses[0]);
        console.log("  Receiver:", depositAddresses[1]);
        if (depositAddresses[4]) console.log("  Market:", depositAddresses[4]);
    } else {
        console.log("\n❌ Deposit data not found - it was executed or cancelled");
    }
}

main().catch(console.error);