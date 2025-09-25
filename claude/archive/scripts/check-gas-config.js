const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING GAS CONFIGURATION ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check execution gas limits
    const ESTIMATED_GAS_FEE_BASE_AMOUNT = ethers.utils.id("ESTIMATED_GAS_FEE_BASE_AMOUNT");
    const baseGas = await dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT);
    console.log("ESTIMATED_GAS_FEE_BASE_AMOUNT:", baseGas.toString());
    
    const ESTIMATED_GAS_FEE_MULTIPLIER = ethers.utils.id("ESTIMATED_GAS_FEE_MULTIPLIER");
    const multiplier = await dataStore.getUint(ESTIMATED_GAS_FEE_MULTIPLIER);
    console.log("ESTIMATED_GAS_FEE_MULTIPLIER:", multiplier.toString());
    
    const EXECUTE_DEPOSIT_GAS_LIMIT = ethers.utils.id("EXECUTE_DEPOSIT_GAS_LIMIT");
    const depositGasLimit = await dataStore.getUint(EXECUTE_DEPOSIT_GAS_LIMIT);
    console.log("EXECUTE_DEPOSIT_GAS_LIMIT:", depositGasLimit.toString());
    
    if (baseGas.eq(0) || multiplier.eq(0)) {
        console.log("\n⚠️ Gas fee configuration not set!");
        console.log("Setting default values...");
        
        // Set reasonable defaults
        if (baseGas.eq(0)) {
            await dataStore.setUint(ESTIMATED_GAS_FEE_BASE_AMOUNT, ethers.utils.parseUnits("1", 15)); // 0.001 ETH
            console.log("✓ Set ESTIMATED_GAS_FEE_BASE_AMOUNT");
        }
        
        if (multiplier.eq(0)) {
            await dataStore.setUint(ESTIMATED_GAS_FEE_MULTIPLIER, ethers.utils.parseUnits("1", 30)); // 1.0 with 30 decimals
            console.log("✓ Set ESTIMATED_GAS_FEE_MULTIPLIER");
        }
    }
    
    if (depositGasLimit.eq(0)) {
        console.log("\nSetting EXECUTE_DEPOSIT_GAS_LIMIT...");
        await dataStore.setUint(EXECUTE_DEPOSIT_GAS_LIMIT, 3000000); // 3M gas
        console.log("✓ Set EXECUTE_DEPOSIT_GAS_LIMIT");
    }
}

main().catch(console.error);
