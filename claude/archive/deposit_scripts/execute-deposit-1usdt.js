const { ethers } = require("hardhat");

async function main() {
    console.log("=== Executing 1 USDT Deposit ===\n");
    
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
    
    // Check vault balance
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    if (vaultBalance.eq(0)) {
        console.log("❌ No USDT in DepositVault");
        return;
    }
    console.log("✅ DepositVault has", ethers.utils.formatUnits(vaultBalance, 6), "USDT\n");
    
    // Find deposit key
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
        console.log("❌ No active deposits");
        console.log("   Run: npx hardhat run claude_context/deposit_scripts/create-first-deposit-1usdt.js --network arbitrumSepolia");
        return;
    }
    
    const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
    const DEPOSIT_KEY = depositKeys[0];
    console.log("Deposit key:", DEPOSIT_KEY, "\n");
    
    // CLEAR AND SET EVERYTHING FRESH
    console.log("🚀 EXECUTING ALL STEPS:\n");
    
    // 1. Clear all prices first
    console.log("1️⃣ Clearing old prices...");
    await oracle.clearAllPrices();
    console.log("   ✅ Done");
    
    // 2. Set USDT price
    console.log("2️⃣ Setting USDT price...");
    const usdtPrice = ethers.utils.parseUnits("1", 30);
    await oracle.setPrimaryPrice(USDT, { min: usdtPrice, max: usdtPrice });
    console.log("   ✅ Done");
    
    // 3. Set sNGN price
    console.log("3️⃣ Setting sNGN price...");
    const ngnPrice = ethers.utils.parseUnits("1500", 30);
    await oracle.setPrimaryPrice(sNGN, { min: ngnPrice, max: ngnPrice });
    console.log("   ✅ Done");
    
    // 4. Set timestamps with narrow window
    console.log("4️⃣ Setting timestamps...");
    const currentTime = Math.floor(Date.now() / 1000);
    await oracle.setTimestamps(currentTime - 30, currentTime + 30);
    console.log("   ✅ Done (window: -30 to +30 seconds)");
    
    // 5. IMMEDIATELY execute
    console.log("5️⃣ Executing deposit NOW...");
    
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
        
        console.log("   Transaction sent:", executeTx.hash);
        const receipt = await executeTx.wait();
        
        console.log("\n📊 RESULT:");
        console.log("   Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
        console.log("   Gas used:", receipt.gasUsed.toString());
        
        if (receipt.status === 0) {
            console.log("\n   Failed tx: https://sepolia.arbiscan.io/tx/" + executeTx.hash);
        }
        
        // Check market token
        const marketToken = await ethers.getContractAt("IERC20", "0x6136252ce73bD4dA432F85b2A7065481DE227601");
        const supply = await marketToken.totalSupply();
        
        if (supply.gt(0)) {
            console.log("\n🎉 MARKET INITIALIZED! Supply:", ethers.utils.formatEther(supply));
            console.log("✅ The 1 USDT deposit worked!");
            console.log("\n💡 This confirms the issue was deposit size - 100 USDT was too much!");
        } else {
            console.log("\n⚠️ Market still empty - deposit was cancelled");
            console.log("Even 1 USDT failed - the issue is not deposit size");
        }
    } catch (error) {
        console.log("\n❌ Execution failed:", error.message);
        if (error.transactionHash) {
            console.log("   Failed tx: https://sepolia.arbiscan.io/tx/" + error.transactionHash);
        }
    }
    
    // Check final state
    const finalVaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const yourBalance = await usdt.balanceOf(signer.address);
    console.log("\nFinal balances:");
    console.log("  DepositVault:", ethers.utils.formatUnits(finalVaultBalance, 6), "USDT");
    console.log("  Your wallet:", ethers.utils.formatUnits(yourBalance, 6), "USDT");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });