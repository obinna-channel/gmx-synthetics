const { ethers } = require("hardhat");

async function main() {
    console.log("=== CALCULATING EXACT EXECUTION FEE REQUIREMENT ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get all gas-related parameters
    const ESTIMATED_GAS_FEE_BASE_AMOUNT = ethers.utils.id("ESTIMATED_GAS_FEE_BASE_AMOUNT");
    const baseAmount = await dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT);

    const ESTIMATED_GAS_FEE_MULTIPLIER = ethers.utils.id("ESTIMATED_GAS_FEE_MULTIPLIER");
    const multiplier = await dataStore.getUint(ESTIMATED_GAS_FEE_MULTIPLIER);

    const EXECUTE_DEPOSIT_GAS_LIMIT = ethers.utils.id("EXECUTE_DEPOSIT_GAS_LIMIT");
    const depositGasLimit = await dataStore.getUint(EXECUTE_DEPOSIT_GAS_LIMIT);

    const SINGLE_SWAP_GAS_LIMIT = ethers.utils.id("SINGLE_SWAP_GAS_LIMIT");
    const singleSwapGas = await dataStore.getUint(SINGLE_SWAP_GAS_LIMIT);

    const INCREASE_ORDER_GAS_LIMIT = ethers.utils.id("INCREASE_ORDER_GAS_LIMIT");
    const increaseOrderGas = await dataStore.getUint(INCREASE_ORDER_GAS_LIMIT);

    const EXECUTE_DEPOSIT_GAS_FEE = ethers.utils.id("EXECUTE_DEPOSIT_GAS_FEE");
    const depositGasFee = await dataStore.getUint(EXECUTE_DEPOSIT_GAS_FEE);

    // Check oracle precision
    const currentGasPrice = await ethers.provider.getGasPrice();

    console.log("=== GAS CONFIGURATION ===");
    console.log("ESTIMATED_GAS_FEE_BASE_AMOUNT:", ethers.utils.formatUnits(baseAmount, 18), "ETH");
    console.log("ESTIMATED_GAS_FEE_MULTIPLIER:", ethers.utils.formatUnits(multiplier, 30));
    console.log("EXECUTE_DEPOSIT_GAS_LIMIT:", depositGasLimit.toString());
    console.log("SINGLE_SWAP_GAS_LIMIT:", singleSwapGas.toString());
    console.log("Current gas price:", ethers.utils.formatUnits(currentGasPrice, 9), "Gwei");

    // The calculation in GasUtils.validateExecutionFee is:
    // adjustedGasUsage = estimatedGasLimit + baseGasLimit
    // fee = adjustedGasUsage * gasPrice + baseAmount

    // For deposits with no swaps (our case), oracle count is 2 (long and short token prices)
    const oraclePriceCount = 2;
    const ESTIMATED_GAS_FEE_BASE_GAS_LIMIT = ethers.utils.id("ESTIMATED_GAS_FEE_BASE_GAS_LIMIT");
    const baseGasLimit = await dataStore.getUint(ESTIMATED_GAS_FEE_BASE_GAS_LIMIT);

    const ESTIMATED_GAS_FEE_PER_ORACLE_PRICE = ethers.utils.id("ESTIMATED_GAS_FEE_PER_ORACLE_PRICE");
    const gasPerOracle = await dataStore.getUint(ESTIMATED_GAS_FEE_PER_ORACLE_PRICE);

    console.log("\n=== ORACLE GAS COSTS ===");
    console.log("Base gas limit:", baseGasLimit.toString());
    console.log("Gas per oracle price:", gasPerOracle.toString());
    console.log("Oracle price count:", oraclePriceCount);

    // Calculate total gas
    const totalBaseGas = baseGasLimit.add(gasPerOracle.mul(oraclePriceCount));
    const adjustedGasLimit = depositGasLimit.add(totalBaseGas);

    console.log("\n=== CALCULATION ===");
    console.log("Deposit gas limit:", depositGasLimit.toString());
    console.log("Base gas limit:", baseGasLimit.toString());
    console.log("Oracle gas:", gasPerOracle.mul(oraclePriceCount).toString());
    console.log("Total adjusted gas:", adjustedGasLimit.toString());

    // Calculate fee
    const gasCost = adjustedGasLimit.mul(currentGasPrice).mul(multiplier).div(ethers.utils.parseUnits("1", 30));
    const totalFee = gasCost.add(baseAmount);

    console.log("\n=== FINAL FEE ===");
    console.log("Gas cost:", ethers.utils.formatUnits(gasCost, 18), "ETH");
    console.log("Base amount:", ethers.utils.formatUnits(baseAmount, 18), "ETH");
    console.log("TOTAL REQUIRED:", ethers.utils.formatUnits(totalFee, 18), "ETH");

    console.log("\n=== COMPARISON ===");
    console.log("We tried with: 0.002 ETH - FAILED");
    console.log("Required:", ethers.utils.formatUnits(totalFee, 18), "ETH");
    console.log("Difference:", ethers.utils.formatUnits(totalFee.sub(ethers.utils.parseEther("0.002")), 18), "ETH short");

    // Suggest safe amount
    const safeAmount = totalFee.mul(110).div(100); // Add 10% buffer
    console.log("\nSUGGESTED SAFE AMOUNT (with 10% buffer):", ethers.utils.formatUnits(safeAmount, 18), "ETH");
}

main().catch(console.error);