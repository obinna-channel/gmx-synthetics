const { ethers } = require("hardhat");

async function main() {
    console.log("=== Comparing Key Calculation Methods ===\n");

    const text = "ORACLE_PROVIDER_FOR_TOKEN";

    // Method 1: Using ethers.utils.id() (WRONG for DataStore keys)
    const method1 = ethers.utils.id(text);
    console.log("Method 1 - ethers.utils.id():");
    console.log("  ", method1);

    // Method 2: Using keccak256 + defaultAbiCoder.encode() (CORRECT for DataStore keys)
    const method2 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], [text])
    );
    console.log("\nMethod 2 - keccak256(defaultAbiCoder.encode()):");
    console.log("  ", method2);

    console.log("\n" + "=".repeat(60));
    if (method1 === method2) {
        console.log("✅ Methods produce the SAME hash");
    } else {
        console.log("❌ Methods produce DIFFERENT hashes!");
        console.log("   This is the bug - NVDA used method 1, should use method 2");
    }
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
