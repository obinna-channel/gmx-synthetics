const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Last Deposit Details ===\n");
    
    const [signer] = await ethers.getSigners();
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const DEPOSIT_KEY = "0xdca93e68f3d0f9c137afa6ee3c0d624dd0c39c829ae6ec1eff1a4fb442df05a4";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);
    
    console.log("1️⃣ CHECKING DEPOSIT KEY:", DEPOSIT_KEY);
    
    try {
        const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
        
        if (deposit.addresses.account === ethers.constants.AddressZero) {
            console.log("  ❌ Deposit no longer exists (all fields are zero)");
            console.log("     This means it was either executed or cancelled\n");
        } else {
            console.log("  ✅ Deposit still exists!");
            console.log("\n  Details:");
            console.log("    Account:", deposit.addresses.account);
            console.log("    Receiver:", deposit.addresses.receiver);
            console.log("    Market:", deposit.addresses.market);
            console.log("    Initial Long Token:", deposit.addresses.initialLongToken);
            console.log("    Initial Short Token:", deposit.addresses.initialShortToken);
            console.log("    Long Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
            console.log("    Short Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");
            console.log("    Execution Fee:", deposit.numbers.executionFee.toString());
            console.log("    Min Market Tokens:", deposit.numbers.minMarketTokens.toString());
            console.log("    Updated At:", new Date(deposit.numbers.updatedAtTime * 1000).toISOString());
        }
    } catch (error) {
        console.log("  ❌ Error reading deposit:", error.message);
    }
    
    console.log("\n2️⃣ CHECKING ACCOUNT'S DEPOSIT LIST:");
    
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
    console.log("  Your total deposit count:", depositCount.toString());
    
    if (depositCount.gt(0)) {
        console.log("  Your active deposit keys:");
        const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
        for (let i = 0; i < depositKeys.length; i++) {
            console.log(`    [${i}]:`, depositKeys[i]);
            if (depositKeys[i] === DEPOSIT_KEY) {
                console.log("         ^ This matches the deposit we're checking");
            }
        }
    } else {
        console.log("  ❌ No active deposits in your account");
    }
    
    console.log("\n3️⃣ CHECKING MARKET STATE:");
    
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    
    const marketSupply = await marketToken.totalSupply();
    const marketUsdtBalance = await usdt.balanceOf(MARKET);
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const yourUsdtBalance = await usdt.balanceOf(signer.address);
    
    console.log("  Market token supply:", ethers.utils.formatEther(marketSupply));
    console.log("  Market USDT balance:", ethers.utils.formatUnits(marketUsdtBalance, 6), "USDT");
    console.log("  DepositVault USDT:", ethers.utils.formatUnits(vaultUsdtBalance, 6), "USDT");
    console.log("  Your USDT balance:", ethers.utils.formatUnits(yourUsdtBalance, 6), "USDT");
    
    // Check pool amount in DataStore
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
    console.log("  Pool USDT amount (DataStore):", ethers.utils.formatUnits(poolAmount, 6), "USDT");
    
    console.log("\n📊 SUMMARY:");
    if (marketSupply.gt(0) || poolAmount.gt(0)) {
        console.log("  ✅ DEPOSIT WAS EXECUTED SUCCESSFULLY!");
        console.log("     Market has been initialized with liquidity");
    } else if (vaultUsdtBalance.gt(0)) {
        console.log("  ⏳ Deposit created but NOT yet executed");
        console.log("     USDT is waiting in DepositVault");
    } else {
        console.log("  ❌ Deposit was cancelled/refunded");
        console.log("     USDT returned to your wallet");
    }
}

main().catch(console.error);
