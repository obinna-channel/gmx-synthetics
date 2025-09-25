const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking New Deposit Details ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check if deposit exists in DEPOSIT structure
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
    const depositNumbers = await dataStore.getUintArray(depositDataKey);

    if (depositAddresses.length > 0) {
        console.log("✅ Deposit is ACTIVE in DataStore");
        console.log("\nDeposit details:");
        console.log("  Account:", depositAddresses[0]);
        console.log("  Receiver:", depositAddresses[1]);
        console.log("  Market:", depositAddresses[4]);
        
        if (depositAddresses[1] === "0x0000000000000000000000000000000000000001") {
            console.log("  ✅ Using address(1) as receiver - CORRECT for first deposit!");
        }
        
        if (depositNumbers.length > 0) {
            console.log("\nAmounts:");
            console.log("  USDT:", depositNumbers[0]?.toString() || "0");
            console.log("  sNGN:", depositNumbers[1]?.toString() || "0");
            console.log("  Execution Fee:", depositNumbers[4] ? ethers.utils.formatEther(depositNumbers[4]) + " ETH" : "0");
        }
        
        console.log("\n🎆 Deposit is ready for keeper execution!");
    } else {
        console.log("❌ Deposit not found in DEPOSIT structure");
        console.log("It may have been executed or there was an issue.");
        
        // Check transaction logs
        const provider = ethers.provider;
        const tx = await provider.getTransaction("0x2cc6da398d6de601b26544ee499bcdcecdb85d81ca2e6fe2e0d38d35a5021773");
        const receipt = await provider.getTransactionReceipt(tx.hash);
        
        console.log("\nTransaction status:", receipt.status ? "SUCCESS" : "FAILED");
        console.log("Events emitted:", receipt.logs.length);
    }
}

main().catch(console.error);