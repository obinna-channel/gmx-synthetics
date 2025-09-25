const { ethers } = require("hardhat");

async function main() {
    console.log("=== Finding and Executing Active Deposit ===\n");
    
    const [signer] = await ethers.getSigners();
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const reader = await ethers.getContractAt("Reader", READER);
    
    // Find active deposits
    console.log("1️⃣ FINDING ACTIVE DEPOSITS...");
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
    
    if (depositCount.eq(0)) {
        console.log("  ❌ No active deposits found");
        return;
    }
    
    const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
    const DEPOSIT_KEY = depositKeys[0];
    
    console.log("  ✅ Found deposit:", DEPOSIT_KEY);
    
    // Get deposit details
    const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
    console.log("  Account:", deposit.addresses.account);
    console.log("  Receiver:", deposit.addresses.receiver);
    console.log("  Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
    
    // Execute
    console.log("\n2️⃣ EXECUTING DEPOSIT...");
    
    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };
    
    try {
        const executeTx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            { gasLimit: 5000000 }
        );
        
        console.log("  Transaction sent:", executeTx.hash);
        console.log("  Waiting for confirmation...");
        
        const receipt = await executeTx.wait();
        
        if (receipt.status === 1) {
            console.log("\n✅ Transaction successful!");
            console.log("  Block:", receipt.blockNumber);
            console.log("  Gas used:", receipt.gasUsed.toString());
        } else {
            console.log("\n❌ Transaction failed");
        }
        
    } catch (error) {
        console.log("\n❌ Execution failed!");
        console.log("  Error:", error.message);
    }
}

main().catch(console.error);
