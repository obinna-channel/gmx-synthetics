const { ethers } = require("hardhat");

async function main() {
    console.log("=== Deep Diagnosis - Tracing Execution Path ===\n");
    
    const [signer] = await ethers.getSigners();
    
    // First, let's check what happens in a simulated execution
    console.log("Step 1: Simulating deposit execution to trace the path...\n");
    
    const DEPOSIT_HANDLER = "0xEfA03387703cc220e6273fB25Fa847d474984057";
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    
    // We need an active deposit first
    const DATA_STORE = "0xb6840dd443cd484ff8f89cf7d766549b768db21f";
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
        console.log("No active deposit. Please create one first using:")
        console.log("npx hardhat run claude_context/deposit_scripts/create-first-deposit-correct.js --network arbitrumSepolia\n");
        return;
    }
    
    const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
    const DEPOSIT_KEY = depositKeys[0];
    console.log("Found deposit key:", DEPOSIT_KEY, "\n");
    
    // Check the deposit details
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const reader = await ethers.getContractAt("Reader", READER);
    
    const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
    console.log("Deposit details:");
    console.log("  Market:", deposit.addresses.market);
    console.log("  Long token:", deposit.addresses.initialLongToken);
    console.log("  Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
    console.log("  Receiver:", deposit.addresses.receiver);
    console.log("  Execution fee:", deposit.numbers.executionFee.toString());
    
    // Check critical validation points
    console.log("\n=== Checking Critical Validation Points ===\n");
    
    // 1. Check if first deposit validation is the issue
    const MARKET = deposit.addresses.market;
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    const totalSupply = await marketToken.totalSupply();
    
    if (totalSupply.eq(0)) {
        console.log("1. FIRST DEPOSIT CHECK:");
        console.log("   This is the first deposit (supply = 0)");
        console.log("   Receiver must be address(1):", deposit.addresses.receiver === "0x0000000000000000000000000000000000000001" ? "✅" : "❌");
        console.log("   Execution fee must be 0:", deposit.numbers.executionFee.eq(0) ? "✅" : "❌");
    }
    
    // 2. Check token balances and approvals
    console.log("\n2. TOKEN CHECKS:");
    const USDT = deposit.addresses.initialLongToken;
    const DEPOSIT_VAULT = "0x149a382b27bf4d9de20142d3e22d0933c9f8c794";
    const usdt = await ethers.getContractAt("IERC20", USDT);
    
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("   DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6));
    
    // 3. Check pool value calculations
    console.log("\n3. POOL VALUE CHECKS:");
    
    const POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );
    
    const poolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "address"], [POOL_AMOUNT, MARKET, USDT])
    );
    const poolAmount = await dataStore.getUint(poolKey);
    console.log("   Current pool amount:", ethers.utils.formatUnits(poolAmount, 6), "USDT");
    
    // 4. Try to understand what ExecuteDepositUtils checks
    console.log("\n4. EXECUTION PATH ANALYSIS:");
    console.log("   Based on 1.4M gas usage, execution reaches:");
    console.log("   ✅ Role validation");
    console.log("   ✅ Deposit existence check");
    console.log("   ✅ Oracle price fetching");
    console.log("   ✅ Market validation");
    console.log("   ✅ Token transfer from vault");
    console.log("   ✅ Swap operations (if any)");
    console.log("   ❌ Market token minting <- LIKELY FAILURE POINT");
    
    // 5. Check for any special requirements
    console.log("\n5. SPECIAL REQUIREMENTS:");
    
    // Check MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT
    const MIN_MARKET_TOKENS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT"])
    );
    const minTokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [MIN_MARKET_TOKENS, MARKET])
    );
    const minTokens = await dataStore.getUint(minTokensKey);
    console.log("   MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT:", ethers.utils.formatEther(minTokens));
    
    // Check if we're hitting a minimum USD value
    console.log("   Deposit value: $100 (at $1/USDT)");
    
    // Try static call to see if it would succeed
    console.log("\n6. STATIC CALL TEST:");
    const oracleParams = {
        tokens: [],
        providers: [],
        data: []
    };
    
    try {
        console.log("   Attempting static call...");
        const result = await depositHandler.callStatic.executeDeposit(
            DEPOSIT_KEY,
            oracleParams,
            { gasLimit: 5000000 }
        );
        console.log("   Static call succeeded!");
        console.log("   Would return:", result);
    } catch (error) {
        console.log("   Static call failed:", error.reason || error.message);
        if (error.errorName) {
            console.log("   Error name:", error.errorName);
        }
        if (error.errorArgs) {
            console.log("   Error args:", error.errorArgs);
        }
    }
    
    console.log("\n=== HYPOTHESIS ===\n");
    console.log("The error 0x95b66fe9 occurs during market token minting.");
    console.log("Possible causes:");
    console.log("1. Minimum liquidity requirement for first mint");
    console.log("2. Pool value calculation issue");
    console.log("3. Market token mint protection/validation");
    console.log("4. Callback or hook in the minting process");
    
    console.log("\nNext step: Check the MarketToken contract directly");
}

main().catch(console.error);