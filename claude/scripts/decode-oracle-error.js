const { ethers } = require("hardhat");

async function main() {
    console.log("=== Decoding Oracle Error ===\n");
    
    const errorData = "0xd84b8ee80000000000000000000000000000000000000000000000000000000068d322ed0000000000000000000000000000000000000000000000000000000068d319a7000000000000000000000000000000000000000000000000000000000000012c";
    
    // Error signature d84b8ee8 is for OracleBlockNumbersAreSmallerThanRequired
    console.log("Error signature:", errorData.slice(0, 10));
    
    // This error has 3 uint256 parameters:
    // uint256[] oracleBlockNumbers, uint256 expectedBlockNumber, uint256 minOracleBlockNumber
    // But since arrays are dynamic, let's decode the specific format
    
    const types = ["uint256", "uint256", "uint256"];
    const decoded = ethers.utils.defaultAbiCoder.decode(types, "0x" + errorData.slice(10));
    
    console.log("\nDecoded error: OracleBlockNumbersAreSmallerThanRequired");
    console.log("  Current block:", decoded[0].toString());
    console.log("  Expected min block:", decoded[1].toString());
    console.log("  Difference:", decoded[2].toString());
    
    // Convert to hex to see block numbers
    console.log("\n  Current block (hex):", "0x" + decoded[0].toHexString());
    console.log("  Expected min (hex):", "0x" + decoded[1].toHexString());
    
    console.log("\n❌ The oracle block numbers are stale!");
    console.log("This means the oracle timestamps we set are too old.");
    console.log("We need to update the oracle with fresh block numbers.");
}

main().catch(console.error);