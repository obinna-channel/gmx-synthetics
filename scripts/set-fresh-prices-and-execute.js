const { ethers } = require("hardhat");

async function main() {
    console.log("=== Setting Fresh Prices and Executing ===\n");
    
    const [signer] = await ethers.getSigners();
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const DEPOSIT_KEY = "0xaaa38ef7cd53ff09fbdf662c0f6c39e9641d98d0635fa16aaf6948a389739b6e";
    
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    // Set fresh prices with current timestamp
    const currentTime = Math.floor(Date.now() / 1000);
    console.log("Setting fresh oracle prices at timestamp:", currentTime);
    
    const usdtPrice = ethers.utils.parseUnits("1", 30);  // $1.00
    const ngnPrice = ethers.utils.parseUnits("1500", 30); // 1500 NGN per USD
    
    // Clear any old prices first
    await oracle.clearAllPrices();
    console.log("✅ Cleared old prices");
    
    // Set USDT price
    await oracle.setPrimaryPrice(USDT, {
        min: usdtPrice,
        max: usdtPrice
    });
    console.log("✅ Set USDT price: $1.00");
    
    // Set sNGN price
    await oracle.setPrimaryPrice(sNGN, {
        min: ngnPrice,
        max: ngnPrice
    });
    console.log("✅ Set sNGN price: 1500 NGN/USD");
    
    // Set fresh timestamps
    await oracle.setTimestamps(currentTime - 1, currentTime + 3600);
    console.log("✅ Set timestamps for 1 hour validity\n");
    
    // Now execute immediately
    console.log("Executing deposit immediately...\n");
    
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    
    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };
    
    try {
        const tx = await depositHandler.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            { gasLimit: 5000000 }
        );
        
        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        
        console.log("\n✅ TRANSACTION COMPLETED");
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
        
        if (receipt.status === 0) {
            console.log("\n❌ Transaction reverted");
            console.log("Check: https://sepolia.arbiscan.io/tx/" + tx.hash);
        }
        
    } catch (error) {
        console.log("\n❌ EXECUTION FAILED");
        console.log("Error:", error.message);
        
        if (error.transactionHash) {
            console.log("\nFailed tx: https://sepolia.arbiscan.io/tx/" + error.transactionHash);
        }
    }
    
    // Check if deposit still exists
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
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
        console.log("\n✅ Deposit was processed!");
        
        // Check if we got market tokens
        const marketToken = await ethers.getContractAt("IERC20", "0x6136252ce73bD4dA432F85b2A7065481DE227601");
        const balance = await marketToken.balanceOf(signer.address);
        
        if (balance.gt(0)) {
            console.log("🎉 SUCCESS! You received market tokens:", ethers.utils.formatEther(balance));
        } else {
            console.log("⚠️ Deposit was cancelled - check your USDT balance");
        }
    } else {
        console.log("\n❌ Deposit still exists - execution failed");
    }
}

main().catch(console.error);