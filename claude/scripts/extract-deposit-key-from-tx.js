const { ethers } = require("hardhat");

async function main() {
    console.log("=== Extracting Deposit Key from Transaction ===\n");
    
    const txHash = "0x2cc6da398d6de601b26544ee499bcdcecdb85d81ca2e6fe2e0d38d35a5021773";
    console.log("Transaction hash:", txHash);
    
    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log("\nTransaction status:", receipt.status ? "SUCCESS" : "FAILED");
    console.log("Block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Logs emitted:", receipt.logs.length);
    
    // Look for deposit-related events
    console.log("\nSearching for deposit key in logs...");
    
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`\nLog ${i}:`);
        console.log("  Topics[0]:", log.topics[0]);
        
        // DepositCreated event signature
        const depositCreatedSig = ethers.utils.id("DepositCreated(bytes32,address,address,address,uint256,uint256)");
        
        if (log.topics[0] === depositCreatedSig) {
            console.log("  ✅ Found DepositCreated event!");
            console.log("  Deposit key:", log.topics[1]);
            return;
        }
        
        // Check if it's an EventLog1 with deposit key
        if (log.topics.length >= 3) {
            // EventLog1 signature
            const eventLog1Sig = "0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160";
            if (log.topics[0] === eventLog1Sig) {
                console.log("  Found EventLog1");
                console.log("  Topic 1 (msgSender):", log.topics[1]);
                console.log("  Topic 2 (possibly deposit key):", log.topics[2]);
            }
        }
    }
    
    console.log("\n📍 Checking account deposits in DataStore...");
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const signer = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    
    const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
    );
    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ACCOUNT_DEPOSIT_LIST, signer]
        )
    );
    
    const depositCount = await dataStore.getBytes32Count(accountKey);
    console.log("Total deposits for account:", depositCount.toString());
    
    if (depositCount.gt(0)) {
        const deposits = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
        console.log("\nAll deposit keys:");
        for (let i = 0; i < deposits.length; i++) {
            console.log(`  ${i + 1}. ${deposits[i]}`);
        }
    }
}

main().catch(console.error);