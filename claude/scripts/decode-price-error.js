const { ethers } = require("hardhat");

async function main() {
    console.log("=== Decoding Price Setting Error ===\n");
    
    const errorData = "0xded099de0000000000000000000000005fe0ca3af9cf758d7f4159295fd1cd6a05562bb600000000000000000000000000000000000000000000d3c21bcecceda100000000000000000000000000000000000000000000000000d3c21bcecceda1000000";
    
    // Error signature ded099de is for EmptyPrimaryPrice
    console.log("Error signature:", errorData.slice(0, 10));
    
    // Decode the parameters
    const types = ["address", "uint256", "uint256"];
    const decoded = ethers.utils.defaultAbiCoder.decode(types, "0x" + errorData.slice(10));
    
    console.log("\nDecoded error: EmptyPrimaryPrice");
    console.log("  Token:", decoded[0]);
    console.log("  Min price:", decoded[1].toString());
    console.log("  Max price:", decoded[2].toString());
    
    console.log("\n❌ The Oracle is rejecting the price!");
    console.log("This might mean:");
    console.log("  1. The price is considered invalid (0 or too extreme)");
    console.log("  2. There's validation logic preventing the update");
    console.log("  3. The Oracle needs to be cleared first");
}

main().catch(console.error);