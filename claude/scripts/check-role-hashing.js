const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Checking Role Hashing Methods ===\n");
    console.log("Your address:", signer.address);

    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Try different hashing methods for ORDER_KEEPER
    console.log("\nTrying different role hash methods for ORDER_KEEPER:");
    
    // Method 1: ethers.utils.id (keccak256 of string)
    const method1 = ethers.utils.id("ORDER_KEEPER");
    console.log("\nMethod 1 - ethers.utils.id('ORDER_KEEPER'):");
    console.log("  Hash:", method1);
    const hasRole1 = await roleStore.hasRole(signer.address, method1);
    console.log("  Has role:", hasRole1 ? "✅ YES" : "❌ NO");
    
    // Method 2: keccak256 of UTF8 bytes
    const method2 = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORDER_KEEPER"));
    console.log("\nMethod 2 - keccak256(toUtf8Bytes('ORDER_KEEPER')):");
    console.log("  Hash:", method2);
    const hasRole2 = await roleStore.hasRole(signer.address, method2);
    console.log("  Has role:", hasRole2 ? "✅ YES" : "❌ NO");
    
    // Method 3: keccak256 of abi.encode
    const method3 = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );
    console.log("\nMethod 3 - keccak256(abi.encode('ORDER_KEEPER')):");
    console.log("  Hash:", method3);
    const hasRole3 = await roleStore.hasRole(signer.address, method3);
    console.log("  Has role:", hasRole3 ? "✅ YES" : "❌ NO");
    
    // Method 4: Just the string "ORDER_KEEPER" as bytes32
    const method4 = ethers.utils.formatBytes32String("ORDER_KEEPER");
    console.log("\nMethod 4 - formatBytes32String('ORDER_KEEPER'):");
    console.log("  Hash:", method4);
    const hasRole4 = await roleStore.hasRole(signer.address, method4);
    console.log("  Has role:", hasRole4 ? "✅ YES" : "❌ NO");
    
    console.log("\n📝 Note: Methods 1 and 2 should produce the same result.");
    console.log("ethers.utils.id() is equivalent to keccak256(toUtf8Bytes())");
}

main().catch(console.error);