const { ethers } = require("hardhat");

async function main() {
    // The decoded parameters from the error
    const param1 = 1135417;
    const param2 = 1200000;
    
    console.log("=== Analyzing Error Parameters ===\n");
    console.log("Param 1:", param1);
    console.log("Param 2:", param2);
    
    // mUSD has 6 decimals
    const decimals = 6;
    console.log("\nWith mUSD decimals (6):");
    console.log("Param 1:", param1 / 10**decimals, "mUSD");
    console.log("Param 2:", param2 / 10**decimals, "mUSD");
    
    console.log("\nThis looks like an insufficient pool balance issue!");
    console.log("Trying to transfer:", param2 / 10**decimals, "mUSD");
    console.log("Pool only has:", param1 / 10**decimals, "mUSD");
    console.log("Shortfall:", (param2 - param1) / 10**decimals, "mUSD");
    
    // Check what error this might be
    const errorSigs = [
        "InsufficientPoolAmount(uint256,uint256)",
        "InsufficientReserve(uint256,uint256)",
        "UnableToWithdrawCollateral(uint256,uint256)",
    ];
    
    console.log("\n=== Checking Error Signatures ===");
    for (const sig of errorSigs) {
        const selector = ethers.utils.id(sig).slice(0, 10);
        console.log(selector, sig);
        if (selector === "0xe73a05d5") {
            console.log("  ✅ MATCH!");
        }
    }
}

main().catch(console.error);
