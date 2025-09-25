const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Status ===\n");
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check if deposit is still in list
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const isInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
    
    console.log("Deposit key:", depositKey);
    console.log("Still in DEPOSIT_LIST:", isInList ? "✅ YES" : "❌ NO");
    
    if (!isInList) {
        console.log("\nThe deposit has been removed from the list.");
        console.log("This could mean:");
        console.log("  1. It was successfully executed (check for market tokens)");
        console.log("  2. It was cancelled");
        console.log("  3. It failed and was removed");
        
        // Check market token balance
        const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
        const marketToken = await ethers.getContractAt("MarketToken", MARKET);
        const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");
        
        console.log("\nMarket token balance of address(1):", ethers.utils.formatEther(address1Balance));
        if (address1Balance.gt(0)) {
            console.log("✅ Deposit was executed! Market has liquidity!");
        } else {
            console.log("❌ No market tokens minted. Deposit failed or was cancelled.");
        }
    } else {
        console.log("\nℹ️ Deposit is still pending and can be executed.");
    }
}

main().catch(console.error);