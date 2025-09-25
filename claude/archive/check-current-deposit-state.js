const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Current Deposit State ===\n");
    
    const [signer] = await ethers.getSigners();
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    
    // Check active deposits
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
    console.log("Number of active deposits:", depositCount.toString());
    
    if (depositCount.gt(0)) {
        const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
        console.log("\nActive deposit keys:");
        
        for (let i = 0; i < depositKeys.length; i++) {
            const key = depositKeys[i];
            console.log(`  [${i}]: ${key}`);
            
            // Try to get deposit details
            try {
                const deposit = await reader.getDeposit(DATA_STORE, key);
                console.log(`       Account: ${deposit.addresses.account}`);
                console.log(`       Receiver: ${deposit.addresses.receiver}`);
                console.log(`       Long amount: ${ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6)} USDT`);
                
                const updatedAt = deposit.numbers.updatedAtTime;
                const currentTime = Math.floor(Date.now() / 1000);
                const age = currentTime - updatedAt;
                console.log(`       Age: ${Math.floor(age/60)} minutes`);
                
                if (age > 3600) {
                    console.log(`       ⚠️ EXPIRED (older than 1 hour)`);
                }
            } catch (e) {
                console.log(`       ❌ Error reading deposit: ${e.message}`);
            }
        }
    } else {
        console.log("\n❌ No active deposits!");
        console.log("   Need to create a new deposit first");
    }
    
    // Check balances
    console.log("\n💰 BALANCES:");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const yourBalance = await usdt.balanceOf(signer.address);
    console.log("  DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("  Your wallet:", ethers.utils.formatUnits(yourBalance, 6), "USDT");
    
    if (vaultBalance.gt(0) && depositCount.eq(0)) {
        console.log("\n⚠️ USDT in vault but no active deposit - deposit was likely cancelled");
    }
}

main().catch(console.error);
