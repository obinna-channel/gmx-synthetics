const { ethers } = require("hardhat");

async function main() {
    console.log("=== Verifying Final Result ===\n");
    
    const [signer] = await ethers.getSigners();
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("1️⃣ MARKET TOKEN SUPPLY:");
    const supply = await marketToken.totalSupply();
    console.log("  Total supply:", ethers.utils.formatEther(supply));
    
    if (supply.gt(0)) {
        console.log("  ✅ Market tokens minted!");
        
        // Check who owns them
        const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");
        console.log("  Address(1) balance:", ethers.utils.formatEther(address1Balance));
    }
    
    console.log("\n2️⃣ POOL AMOUNT:");
    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, USDT]
        )
    );
    
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("  Pool USDT:", ethers.utils.formatUnits(poolAmount, 6), "USDT");
    
    console.log("\n3️⃣ BALANCES:");
    const marketBalance = await usdt.balanceOf(MARKET);
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const yourBalance = await usdt.balanceOf(signer.address);
    
    console.log("  Market USDT:", ethers.utils.formatUnits(marketBalance, 6));
    console.log("  DepositVault USDT:", ethers.utils.formatUnits(vaultBalance, 6));
    console.log("  Your USDT:", ethers.utils.formatUnits(yourBalance, 6));
    
    console.log("\n4️⃣ ACTIVE DEPOSITS:");
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
    console.log("  Remaining deposits:", depositCount.toString());
    
    console.log("\n\n🎯 FINAL VERDICT:");
    if (supply.gt(0) && poolAmount.gt(0)) {
        console.log("  🎉🎉🎉 DEPOSIT EXECUTED SUCCESSFULLY! 🎉🎉🎉");
        console.log("  The USDTNGN market is now INITIALIZED!");
        console.log("  Market has", ethers.utils.formatUnits(poolAmount, 6), "USDT liquidity");
    } else if (yourBalance.gt(ethers.utils.parseUnits("1098100", 6))) {
        console.log("  ❌ Deposit was cancelled and refunded");
    } else {
        console.log("  ⚠️ Unclear status");
    }
}

main().catch(console.error);
