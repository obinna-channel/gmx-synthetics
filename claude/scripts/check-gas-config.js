const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    // Load DataStore
    const dataStorePath = "./deployments/marks/arbitrumSepolia/DataStore.json";
    const dataStoreData = JSON.parse(fs.readFileSync(dataStorePath));
    const dataStore = new ethers.Contract(dataStoreData.address, dataStoreData.abi, ethers.provider);

    console.log("=== Gas Configuration ===\n");

    // The correct key computation using abi.encode (not toUtf8Bytes)
    const abiCoder = new ethers.utils.AbiCoder();

    // MIN_HANDLE_EXECUTION_ERROR_GAS
    const minHandleGasKey = ethers.utils.keccak256(
        abiCoder.encode(["string"], ["MIN_HANDLE_EXECUTION_ERROR_GAS"])
    );
    const minHandleGas = await dataStore.getUint(minHandleGasKey);
    console.log("MIN_HANDLE_EXECUTION_ERROR_GAS:");
    console.log("  Key:", minHandleGasKey);
    console.log("  Value:", minHandleGas.toString());

    // MIN_HANDLE_EXECUTION_ERROR_GAS_TO_FORWARD
    const minHandleGasToForwardKey = ethers.utils.keccak256(
        abiCoder.encode(["string"], ["MIN_HANDLE_EXECUTION_ERROR_GAS_TO_FORWARD"])
    );
    const minHandleGasToForward = await dataStore.getUint(minHandleGasToForwardKey);
    console.log("\nMIN_HANDLE_EXECUTION_ERROR_GAS_TO_FORWARD:");
    console.log("  Key:", minHandleGasToForwardKey);
    console.log("  Value:", minHandleGasToForward.toString());

    // MIN_ADDITIONAL_GAS_FOR_EXECUTION
    const minAdditionalGasKey = ethers.utils.keccak256(
        abiCoder.encode(["string"], ["MIN_ADDITIONAL_GAS_FOR_EXECUTION"])
    );
    const minAdditionalGas = await dataStore.getUint(minAdditionalGasKey);
    console.log("\nMIN_ADDITIONAL_GAS_FOR_EXECUTION:");
    console.log("  Key:", minAdditionalGasKey);
    console.log("  Value:", minAdditionalGas.toString());

    // ESTIMATED_GAS_FEE_BASE_AMOUNT_V2
    const estimatedGasBaseKey = ethers.utils.keccak256(
        abiCoder.encode(["string"], ["ESTIMATED_GAS_FEE_BASE_AMOUNT_V2"])
    );
    const estimatedGasBase = await dataStore.getUint(estimatedGasBaseKey);
    console.log("\nESTIMATED_GAS_FEE_BASE_AMOUNT_V2:");
    console.log("  Value:", estimatedGasBase.toString());

    // EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1
    const executionGasBaseKey = ethers.utils.keccak256(
        abiCoder.encode(["string"], ["EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1"])
    );
    const executionGasBase = await dataStore.getUint(executionGasBaseKey);
    console.log("\nEXECUTION_GAS_FEE_BASE_AMOUNT_V2_1:");
    console.log("  Value:", executionGasBase.toString());

    console.log("\n=== Analysis ===");
    console.log("From the error, we have:");
    console.log("  Gas available at cancel time: 1,084,842");
    console.log("  Min required (from error): 1,200,000");

    if (minHandleGas.gt(0)) {
        console.log("\n⚠️  MIN_HANDLE_EXECUTION_ERROR_GAS is set to", minHandleGas.toString());
        console.log("   This matches the error value of 1,200,000");
        console.log("\n📋 Recommendations:");
        console.log("   1. Increase keeper gas limit buffer (currently 20%, try 50%)");
        console.log("   2. Or reduce MIN_HANDLE_EXECUTION_ERROR_GAS in DataStore");
        console.log("   3. Or add special handling for full position closes");
    }
}

main().catch(console.error);
