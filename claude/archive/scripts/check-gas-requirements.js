const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING GAS AND EXECUTION FEE REQUIREMENTS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get gas price settings
    const ESTIMATED_GAS_FEE_BASE_AMOUNT = ethers.utils.id("ESTIMATED_GAS_FEE_BASE_AMOUNT");
    const baseAmount = await dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT);
    console.log("ESTIMATED_GAS_FEE_BASE_AMOUNT:", ethers.utils.formatUnits(baseAmount, 18), "ETH");

    const ESTIMATED_GAS_FEE_MULTIPLIER = ethers.utils.id("ESTIMATED_GAS_FEE_MULTIPLIER");
    const multiplier = await dataStore.getUint(ESTIMATED_GAS_FEE_MULTIPLIER);
    console.log("ESTIMATED_GAS_FEE_MULTIPLIER:", ethers.utils.formatUnits(multiplier, 30));

    // Get deposit gas limit
    const EXECUTE_DEPOSIT_GAS_LIMIT = ethers.utils.id("EXECUTE_DEPOSIT_GAS_LIMIT");
    const gasLimit = await dataStore.getUint(EXECUTE_DEPOSIT_GAS_LIMIT);
    console.log("EXECUTE_DEPOSIT_GAS_LIMIT:", gasLimit.toString());

    // Calculate minimum execution fee
    // The formula is typically: (gasLimit * gasPrice * multiplier) + baseAmount
    const currentGasPrice = await ethers.provider.getGasPrice();
    console.log("\nCurrent network gas price:", ethers.utils.formatUnits(currentGasPrice, 9), "Gwei");

    // Estimate the required execution fee
    if (gasLimit.gt(0)) {
        const estimatedFee = currentGasPrice.mul(gasLimit).mul(multiplier).div(ethers.utils.parseUnits("1", 30));
        const totalFee = estimatedFee.add(baseAmount);

        console.log("\n=== EXECUTION FEE CALCULATION ===");
        console.log("Gas limit:", gasLimit.toString());
        console.log("Gas price:", ethers.utils.formatUnits(currentGasPrice, 9), "Gwei");
        console.log("Multiplier:", ethers.utils.formatUnits(multiplier, 30));
        console.log("Base amount:", ethers.utils.formatUnits(baseAmount, 18), "ETH");
        console.log("Calculated fee:", ethers.utils.formatUnits(estimatedFee, 18), "ETH");
        console.log("Total required:", ethers.utils.formatUnits(totalFee, 18), "ETH");

        console.log("\nWe provided: 0.001 ETH");
        console.log("Required: ~", ethers.utils.formatUnits(totalFee, 18), "ETH");

        if (totalFee.gt(ethers.utils.parseEther("0.001"))) {
            console.log("\n❌ INSUFFICIENT EXECUTION FEE!");
            console.log("Need to provide at least:", ethers.utils.formatUnits(totalFee, 18), "ETH");
        }
    }

    // Check callback gas limit
    const CALLBACK_GAS_LIMIT = ethers.utils.id("CALLBACK_GAS_LIMIT");
    const MAX_CALLBACK_GAS_LIMIT = ethers.utils.id("MAX_CALLBACK_GAS_LIMIT");

    const callbackGasLimit = await dataStore.getUint(CALLBACK_GAS_LIMIT);
    const maxCallbackGasLimit = await dataStore.getUint(MAX_CALLBACK_GAS_LIMIT);

    console.log("\n=== CALLBACK GAS LIMITS ===");
    console.log("Default callback gas limit:", callbackGasLimit.toString());
    console.log("Max callback gas limit:", maxCallbackGasLimit.toString());
}

main().catch(console.error);