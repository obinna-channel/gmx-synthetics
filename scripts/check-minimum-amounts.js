const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Minimum Amount Requirements ===\n");
    
    const DATA_STORE = "0xb6840dd443cd484ff8f89cf7d766549b768db21f";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check various minimum requirements
    const checks = [
        { key: "MIN_COLLATERAL_USD", description: "Minimum collateral in USD" },
        { key: "MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT", description: "Minimum market tokens for first deposit" },
        { key: "MIN_POSITION_SIZE_USD", description: "Minimum position size in USD" },
        { key: "MIN_ADDITIONAL_GAS_FOR_EXECUTION", description: "Min gas for execution" },
        { key: "MAX_PNL_FACTOR_FOR_DEPOSITS", description: "Max PNL factor for deposits" }
    ];
    
    console.log("Global and market-specific minimums:\n");
    
    for (const check of checks) {
        const keyHash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], [check.key])
        );
        
        // Check global value
        const globalValue = await dataStore.getUint(keyHash);
        console.log(`${check.key}:`);
        console.log(`  Global: ${globalValue.toString()}`);
        
        // Check market-specific value
        const marketKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [keyHash, MARKET])
        );
        const marketValue = await dataStore.getUint(marketKey);
        
        if (!marketValue.eq(0)) {
            if (check.key.includes("USD")) {
                console.log(`  Market: ${ethers.utils.formatUnits(marketValue, 30)} USD`);
            } else if (check.key.includes("FACTOR")) {
                console.log(`  Market: ${ethers.utils.formatUnits(marketValue, 30)} (${(parseFloat(ethers.utils.formatUnits(marketValue, 30)) * 100).toFixed(2)}%)`);
            } else {
                console.log(`  Market: ${marketValue.toString()}`);
            }
        } else {
            console.log(`  Market: 0 (not set)`);
        }
        console.log();
    }
    
    // Calculate what 100 USDT is worth
    console.log("=== Deposit Value Analysis ===\n");
    console.log("Current deposit: 100 USDT");
    console.log("At oracle price: $1.00 per USDT");
    console.log("Total value: $100\n");
    
    // Check if there's a specific first deposit minimum
    console.log("=== Specific First Deposit Checks ===\n");
    
    const FIRST_DEPOSIT_MIN_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["FIRST_DEPOSIT_MIN_AMOUNT"])
    );
    const firstDepositKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [FIRST_DEPOSIT_MIN_AMOUNT, MARKET])
    );
    const firstDepositMin = await dataStore.getUint(firstDepositKey);
    console.log("FIRST_DEPOSIT_MIN_AMOUNT:", firstDepositMin.toString());
    
    // Try to calculate minimum market tokens
    console.log("\n=== Market Token Calculation ===\n");
    console.log("For first deposit with 100 USDT:");
    console.log("- Pool value before: $0");
    console.log("- Pool value after: $100");
    console.log("- Expected market tokens: ~100 (assuming 1:1 initial ratio)");
    
    console.log("\n💡 RECOMMENDATIONS:");
    console.log("If deposit keeps failing with 0x95b66fe9:");
    console.log("1. Try increasing deposit amount (e.g., 1000 USDT)");
    console.log("2. Check if market needs initial seed liquidity");
    console.log("3. Verify price impact calculations");
}

main().catch(console.error);