const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking What Happened to Last Deposit ===\\n");
    
    const [signer] = await ethers.getSigners();
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    
    // The deposit key from our last attempt
    const LAST_DEPOSIT_KEY = "0xaaa38ef7cd53ff09fbdf662c0f6c39e9641d98d0635fa16aaf6948a389739b6e";
    
    console.log("Last deposit key we tried:", LAST_DEPOSIT_KEY);
    
    // Check if it still exists
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
    console.log("\\nActive deposits in your account:", depositCount.toString());
    
    if (depositCount.gt(0)) {
        const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
        let foundLastDeposit = false;
        
        for (const key of depositKeys) {
            if (key === LAST_DEPOSIT_KEY) {
                foundLastDeposit = true;
                console.log("✅ Last deposit STILL EXISTS - was not executed");
                break;
            }
        }
        
        if (!foundLastDeposit) {
            console.log("❌ Last deposit no longer exists - was executed or cancelled");
            console.log("\\nCurrent active deposits:");
            for (let i = 0; i < depositKeys.length; i++) {
                console.log("  ", depositKeys[i]);
            }
        }
    }
    
    // Check balances
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const yourBalance = await usdt.balanceOf(signer.address);
    
    console.log("\\nBalances:");
    console.log("  DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("  Your wallet:", ethers.utils.formatUnits(yourBalance, 6), "USDT");
    
    console.log("\\n📊 CONCLUSION:");
    if (vaultBalance.eq(0) && depositCount.eq(0)) {
        console.log("  The last deposit was processed (executed or cancelled)");
        console.log("  USDT was returned to your wallet");
        console.log("  Need to create a NEW deposit");
    } else if (vaultBalance.gt(0) && depositCount.gt(0)) {
        console.log("  There's an active deposit ready to execute");
    } else if (vaultBalance.gt(0) && depositCount.eq(0)) {
        console.log("  ⚠️ Weird state - USDT in vault but no deposit record");
    }
}

main().catch(console.error);
