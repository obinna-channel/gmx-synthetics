const { ethers } = require("hardhat");

async function main() {
    console.log("=== Executing Liquidity Deposit ===\n");
    
    const [signer] = await ethers.getSigners();
    
    // Contracts
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057"; 
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    
    // Check current market token balance
    const initialBalance = await marketToken.balanceOf(signer.address);
    console.log("Your current market tokens:", ethers.utils.formatEther(initialBalance));
    
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
        console.log("\n❌ No active deposits");
        console.log("   Run: npx hardhat run claude_context/deposit_scripts/add-liquidity.js --network arbitrumSepolia");
        return;
    }
    
    const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
    const DEPOSIT_KEY = depositKeys[0];
    console.log("\nDeposit key:", DEPOSIT_KEY);
    
    // Get deposit details
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const reader = await ethers.getContractAt("Reader", READER);
    
    try {
        const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
        const amount = ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6);
        console.log("Deposit amount:", amount, "USDT");
        console.log("Receiver:", deposit.addresses.receiver);
    } catch (e) {
        console.log("Could not read deposit details");
    }
    
    // Set oracle prices and execute
    console.log("\n🚀 EXECUTING DEPOSIT:\n");
    
    // 1. Clear old prices
    console.log("1️⃣ Clearing old prices...");
    await oracle.clearAllPrices();
    console.log("   ✅ Done");
    
    // 2. Set USDT price
    console.log("2️⃣ Setting USDT price ($1.00)...");
    const usdtPrice = ethers.utils.parseUnits("1", 30);
    await oracle.setPrimaryPrice(USDT, { min: usdtPrice, max: usdtPrice });
    console.log("   ✅ Done");
    
    // 3. Set sNGN price
    console.log("3️⃣ Setting sNGN price (1500 NGN/USD)...");
    const ngnPrice = ethers.utils.parseUnits("1500", 30);
    await oracle.setPrimaryPrice(sNGN, { min: ngnPrice, max: ngnPrice });
    console.log("   ✅ Done");
    
    // 4. Set timestamps
    console.log("4️⃣ Setting oracle timestamps...");
    const currentTime = Math.floor(Date.now() / 1000);
    await oracle.setTimestamps(currentTime - 30, currentTime + 30);
    console.log("   ✅ Done");
    
    // 5. Execute deposit
    console.log("5️⃣ Executing deposit...");
    
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
        
        if (receipt.status === 1) {
            // Check new market token balance
            const newBalance = await marketToken.balanceOf(signer.address);
            const received = newBalance.sub(initialBalance);
            
            if (received.gt(0)) {
                console.log("\n🎉 SUCCESS! You received market tokens!");
                console.log("   Market tokens received:", ethers.utils.formatEther(received));
                console.log("   Your total market tokens:", ethers.utils.formatEther(newBalance));
                console.log("\n💡 These tokens represent your share of the liquidity pool");
                console.log("   You earn fees from trades and can withdraw anytime");
            }
            
            // Show total market liquidity
            const totalSupply = await marketToken.totalSupply();
            console.log("\n📊 Market statistics:");
            console.log("   Total market token supply:", ethers.utils.formatEther(totalSupply));
            
            const yourShare = newBalance.mul(10000).div(totalSupply);
            console.log("   Your pool share:", yourShare.toNumber() / 100, "%");
        }
        
    } catch (error) {
        console.log("\n❌ Execution failed:", error.message);
        if (error.transactionHash) {
            console.log("   Failed tx: https://sepolia.arbiscan.io/tx/" + error.transactionHash);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });