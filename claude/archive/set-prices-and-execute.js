const { ethers } = require("hardhat");

async function main() {
    console.log("=== Setting Prices and Executing Deposit ===\n");
    
    const [signer] = await ethers.getSigners();
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Step 1: Set oracle prices
    console.log("1️⃣ SETTING ORACLE PRICES...");
    
    const usdtPrice = ethers.utils.parseUnits("1", "30");
    const ngnPrice = ethers.utils.parseUnits("1500", "30");
    
    const tx1 = await oracle.setPrimaryPrice(USDT, { min: usdtPrice, max: usdtPrice });
    await tx1.wait();
    console.log("  ✅ USDT price set to $1");
    
    const tx2 = await oracle.setPrimaryPrice(sNGN, { min: ngnPrice, max: ngnPrice });
    await tx2.wait();
    console.log("  ✅ sNGN price set to 1500");
    
    // Step 2: Set timestamps
    console.log("\n2️⃣ SETTING ORACLE TIMESTAMPS...");
    const currentTime = Math.floor(Date.now() / 1000);
    const tx3 = await oracle.setTimestamps(currentTime - 30, currentTime + 30);
    await tx3.wait();
    console.log("  ✅ Timestamps updated");
    
    // Step 3: Find active deposit
    console.log("\n3️⃣ FINDING ACTIVE DEPOSIT...");
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
        console.log("  ❌ No active deposits");
        return;
    }
    
    const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
    const DEPOSIT_KEY = depositKeys[0];
    console.log("  ✅ Found deposit:", DEPOSIT_KEY);
    
    // Step 4: Execute
    console.log("\n4️⃣ EXECUTING DEPOSIT...");
    
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
        
        console.log("\n✅ Transaction completed!");
        console.log("  Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());
        
    } catch (error) {
        console.log("\n❌ Execution failed!");
        console.log("  Error:", error.message);
    }
}

main().catch(console.error);
