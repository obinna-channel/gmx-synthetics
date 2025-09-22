const { ethers } = require("hardhat");

async function main() {
    console.log("=== All-in-One Deposit Execution ===\n");
    console.log("This script sets prices and executes immediately to avoid clearing\n");
    
    const [signer] = await ethers.getSigners();
    
    // Contracts
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057"; 
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    
    // Check if we need to create a deposit first
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    if (vaultBalance.eq(0)) {
        console.log("❌ No USDT in DepositVault - need to create a deposit first");
        return;
    }
    
    console.log("✅ DepositVault has", ethers.utils.formatUnits(vaultBalance, 6), "USDT ready\n");
    
    // Find active deposit key - if none, we need to create one
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
    
    let DEPOSIT_KEY;
    if (depositCount.eq(0)) {
        console.log("⚠️ No active deposits - need to create one first");
        console.log("Run: npx hardhat run scripts/create-first-deposit-correct.js --network arbitrumSepolia");
        return;
    } else {
        const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
        DEPOSIT_KEY = depositKeys[0];
        console.log("Found deposit key:", DEPOSIT_KEY, "\n");
    }
    
    // ALL STEPS IN RAPID SUCCESSION
    console.log("🚀 EXECUTING ALL STEPS QUICKLY:\n");
    
    // 1. Set USDT price
    console.log("1️⃣ Setting USDT price...");
    const usdtPrice = ethers.utils.parseUnits("1", "30");
    await (await oracle.setPrimaryPrice(USDT, { min: usdtPrice, max: usdtPrice })).wait();
    console.log("   ✅ Done");
    
    // 2. Set sNGN price
    console.log("2️⃣ Setting sNGN price...");
    const ngnPrice = ethers.utils.parseUnits("1500", "30");
    await (await oracle.setPrimaryPrice(sNGN, { min: ngnPrice, max: ngnPrice })).wait();
    console.log("   ✅ Done");
    
    // 3. Set timestamps
    console.log("3️⃣ Setting timestamps...");
    const currentTime = Math.floor(Date.now() / 1000);
    await (await oracle.setTimestamps(currentTime - 30, currentTime + 30)).wait();
    console.log("   ✅ Done");
    
    // 4. IMMEDIATELY execute deposit
    console.log("4️⃣ Executing deposit IMMEDIATELY...");
    
    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };
    
    const executeTx = await depositHandler.executeDeposit(
        DEPOSIT_KEY,
        oracleParams,
        { gasLimit: 5000000 }
    );
    
    console.log("   Transaction sent:", executeTx.hash);
    const receipt = await executeTx.wait();
    
    console.log("\n📊 RESULT:");
    console.log("   Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
    console.log("   Gas used:", receipt.gasUsed.toString());
    
    // Quick check of results
    const marketToken = await ethers.getContractAt("IERC20", "0x6136252ce73bD4dA432F85b2A7065481DE227601");
    const supply = await marketToken.totalSupply();
    
    if (supply.gt(0)) {
        console.log("\n🎉 MARKET INITIALIZED! Supply:", ethers.utils.formatEther(supply));
    } else {
        console.log("\n⚠️ Market still empty - deposit was likely cancelled");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
