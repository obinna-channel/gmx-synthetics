// Script to check gas configuration values in deployed DataStore
const hre = require("hardhat");
const { ethers } = hre;

// Key hashes (from utils/keys.ts)
// IMPORTANT: hashString uses ABI encoding before hashing, not direct keccak256!
function hashString(str) {
  const bytes = ethers.utils.defaultAbiCoder.encode(["string"], [str]);
  return ethers.utils.keccak256(ethers.utils.arrayify(bytes));
}

const KEYS = {
  ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1: hashString("ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1"),
  ESTIMATED_GAS_FEE_PER_ORACLE_PRICE: hashString("ESTIMATED_GAS_FEE_PER_ORACLE_PRICE"),
  ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR: hashString("ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR"),
  EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1: hashString("EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1"),
  EXECUTION_GAS_FEE_PER_ORACLE_PRICE: hashString("EXECUTION_GAS_FEE_PER_ORACLE_PRICE"),
  EXECUTION_GAS_FEE_MULTIPLIER_FACTOR: hashString("EXECUTION_GAS_FEE_MULTIPLIER_FACTOR"),
  MAX_EXECUTION_FEE_MULTIPLIER_FACTOR: hashString("MAX_EXECUTION_FEE_MULTIPLIER_FACTOR"),

  // Gas limits for different operations
  SINGLE_SWAP_GAS_LIMIT: hashString("SINGLE_SWAP_GAS_LIMIT"),
  INCREASE_ORDER_GAS_LIMIT: hashString("INCREASE_ORDER_GAS_LIMIT"),
  DECREASE_ORDER_GAS_LIMIT: hashString("DECREASE_ORDER_GAS_LIMIT"),
  SWAP_ORDER_GAS_LIMIT: hashString("SWAP_ORDER_GAS_LIMIT"),
  DEPOSIT_GAS_LIMIT: hashString("DEPOSIT_GAS_LIMIT"),
  WITHDRAWAL_GAS_LIMIT: hashString("WITHDRAWAL_GAS_LIMIT"),
};

async function main() {
  console.log("Reading gas configuration from deployed DataStore...\n");

  const dataStore = await ethers.getContract("DataStore");
  console.log("DataStore address:", dataStore.address);

  // Get current gas price
  const gasPrice = await ethers.provider.getGasPrice();
  const gasPriceGwei = ethers.utils.formatUnits(gasPrice, "gwei");
  console.log("Current gas price:", gasPriceGwei, "gwei\n");

  console.log("=== GAS CONFIGURATION VALUES ===\n");

  // Read estimated gas fee configuration
  const estimatedBaseAmount = await dataStore.getUint(KEYS.ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1);
  const estimatedPerOraclePrice = await dataStore.getUint(KEYS.ESTIMATED_GAS_FEE_PER_ORACLE_PRICE);
  const estimatedMultiplier = await dataStore.getUint(KEYS.ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR);

  console.log("Estimated Gas Fee Configuration:");
  console.log("  Base Amount:", estimatedBaseAmount.toString());
  console.log("  Per Oracle Price:", estimatedPerOraclePrice.toString());
  console.log("  Multiplier Factor:", estimatedMultiplier.toString());
  console.log("  Multiplier Factor (decimal):", ethers.utils.formatUnits(estimatedMultiplier, 30));
  console.log();

  // Read execution gas fee configuration
  const executionBaseAmount = await dataStore.getUint(KEYS.EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1);
  const executionPerOraclePrice = await dataStore.getUint(KEYS.EXECUTION_GAS_FEE_PER_ORACLE_PRICE);
  const executionMultiplier = await dataStore.getUint(KEYS.EXECUTION_GAS_FEE_MULTIPLIER_FACTOR);

  console.log("Execution Gas Fee Configuration:");
  console.log("  Base Amount:", executionBaseAmount.toString());
  console.log("  Per Oracle Price:", executionPerOraclePrice.toString());
  console.log("  Multiplier Factor:", executionMultiplier.toString());
  console.log("  Multiplier Factor (decimal):", ethers.utils.formatUnits(executionMultiplier, 30));
  console.log();

  // Read max execution fee multiplier
  const maxExecutionMultiplier = await dataStore.getUint(KEYS.MAX_EXECUTION_FEE_MULTIPLIER_FACTOR);
  console.log("Max Execution Fee Multiplier:", maxExecutionMultiplier.toString());
  console.log("Max Execution Fee Multiplier (decimal):", ethers.utils.formatUnits(maxExecutionMultiplier, 30));
  console.log();

  // Read gas limits for different operations
  console.log("=== GAS LIMITS BY OPERATION ===\n");

  const singleSwapGasLimit = await dataStore.getUint(KEYS.SINGLE_SWAP_GAS_LIMIT);
  const increaseOrderGasLimit = await dataStore.getUint(KEYS.INCREASE_ORDER_GAS_LIMIT);
  const decreaseOrderGasLimit = await dataStore.getUint(KEYS.DECREASE_ORDER_GAS_LIMIT);
  const swapOrderGasLimit = await dataStore.getUint(KEYS.SWAP_ORDER_GAS_LIMIT);
  const depositGasLimit = await dataStore.getUint(KEYS.DEPOSIT_GAS_LIMIT);
  const withdrawalGasLimit = await dataStore.getUint(KEYS.WITHDRAWAL_GAS_LIMIT);

  console.log("Single Swap Gas Limit:", singleSwapGasLimit.toString());
  console.log("Increase Order Gas Limit:", increaseOrderGasLimit.toString());
  console.log("Decrease Order Gas Limit:", decreaseOrderGasLimit.toString());
  console.log("Swap Order Gas Limit:", swapOrderGasLimit.toString());
  console.log("Deposit Gas Limit:", depositGasLimit.toString());
  console.log("Withdrawal Gas Limit:", withdrawalGasLimit.toString());
  console.log();

  // Calculate example execution fees
  console.log("=== EXAMPLE EXECUTION FEE CALCULATIONS ===\n");

  // For a typical market order with 3 oracle prices (standard for orders)
  const oraclePriceCount = 3;
  const exampleGasUsed = 500000; // Example gas used

  // Calculate using the formula from GasUtils.sol
  // gasLimit = baseGasLimit + applyFactor(estimatedGasLimit, multiplierFactor)
  // where baseGasLimit = ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1 + ESTIMATED_GAS_FEE_PER_ORACLE_PRICE * oraclePriceCount

  const baseGasLimit = estimatedBaseAmount.add(estimatedPerOraclePrice.mul(oraclePriceCount));
  const multipliedGas = exampleGasUsed * parseFloat(ethers.utils.formatUnits(estimatedMultiplier, 30));
  const totalGasLimit = baseGasLimit.add(Math.floor(multipliedGas));

  const executionFee = totalGasLimit.mul(gasPrice);
  const executionFeeEth = ethers.utils.formatEther(executionFee);

  console.log("For a market order (example):");
  console.log("  Oracle prices needed:", oraclePriceCount);
  console.log("  Estimated gas used:", exampleGasUsed);
  console.log("  Base gas limit:", baseGasLimit.toString());
  console.log("  Total gas limit:", totalGasLimit.toString());
  console.log("  Execution fee:", executionFeeEth, "ETH");
  console.log();

  // Calculate for increase order with callback gas
  const increaseOrderTotalGas = increaseOrderGasLimit;
  const increaseOrderBaseGas = estimatedBaseAmount.add(estimatedPerOraclePrice.mul(oraclePriceCount));
  const increaseOrderEstimatedGas = increaseOrderBaseGas.add(
    increaseOrderTotalGas.mul(estimatedMultiplier).div(ethers.utils.parseUnits("1", 30))
  );
  const increaseOrderFee = increaseOrderEstimatedGas.mul(gasPrice);
  const increaseOrderFeeEth = ethers.utils.formatEther(increaseOrderFee);

  console.log("For an increase order (no swaps):");
  console.log("  Gas limit:", increaseOrderGasLimit.toString());
  console.log("  Estimated total gas:", increaseOrderEstimatedGas.toString());
  console.log("  Execution fee:", increaseOrderFeeEth, "ETH");
  console.log();

  // Calculate for decrease order
  const decreaseOrderTotalGas = decreaseOrderGasLimit;
  const decreaseOrderBaseGas = estimatedBaseAmount.add(estimatedPerOraclePrice.mul(oraclePriceCount));
  const decreaseOrderEstimatedGas = decreaseOrderBaseGas.add(
    decreaseOrderTotalGas.mul(estimatedMultiplier).div(ethers.utils.parseUnits("1", 30))
  );
  const decreaseOrderFee = decreaseOrderEstimatedGas.mul(gasPrice);
  const decreaseOrderFeeEth = ethers.utils.formatEther(decreaseOrderFee);

  console.log("For a decrease order (no swaps):");
  console.log("  Gas limit:", decreaseOrderGasLimit.toString());
  console.log("  Estimated total gas:", decreaseOrderEstimatedGas.toString());
  console.log("  Execution fee:", decreaseOrderFeeEth, "ETH");
  console.log();

  console.log("=== COMPARISON WITH CURRENT FRONTEND ===\n");
  console.log("Current frontend hardcoded fee: 0.0005 ETH");
  console.log("Calculated increase order fee:", increaseOrderFeeEth, "ETH");
  console.log("Calculated decrease order fee:", decreaseOrderFeeEth, "ETH");

  const difference = parseFloat(increaseOrderFeeEth) - 0.0005;
  const percentDiff = (difference / 0.0005) * 100;
  console.log("Difference: ", difference > 0 ? "+" : "", difference.toFixed(6), "ETH (", percentDiff.toFixed(2), "%)");
  console.log();

  if (Math.abs(difference) > 0.0001) {
    console.log("⚠️  WARNING: Frontend execution fee differs significantly from calculated fee!");
    console.log("   Users may be overpaying or transactions may fail due to insufficient execution fee.");
  } else {
    console.log("✅ Frontend execution fee is close to calculated fee.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
