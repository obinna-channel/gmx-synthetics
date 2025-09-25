const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking ORDER_KEEPER Role Holders ===\n");
    
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    // ORDER_KEEPER role hash - using keccak256(abi.encode())
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );
    
    console.log("ORDER_KEEPER role hash:", ORDER_KEEPER);
    
    // Get role member count
    const memberCount = await roleStore.getRoleMemberCount(ORDER_KEEPER);
    console.log("\nNumber of ORDER_KEEPER role holders:", memberCount.toString());

    if (memberCount.gt(0)) {
        console.log("\nORDER_KEEPER role holders:");
        // Note: RoleStore doesn't have getRoleMember, but we know there are 8 holders
        console.log("  (Cannot enumerate members - RoleStore doesn't expose this)");
        console.log("  Total count: " + memberCount.toString());
    } else {
        console.log("\n❌ No addresses have the ORDER_KEEPER role!");
        console.log("This explains why deposit execution is failing.");
    }
    
    // Check if your address has it
    const [signer] = await ethers.getSigners();
    const hasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
    console.log("\nYour address:", signer.address);
    console.log("Has ORDER_KEEPER role:", hasRole ? "✅" : "❌");
    
    // Check role admin for ORDER_KEEPER
    const roleAdmin = await roleStore.getRoleAdmin(ORDER_KEEPER);
    console.log("\nORDER_KEEPER role admin:", roleAdmin);
    
    // Check if we're the admin
    const isAdmin = await roleStore.hasRole(signer.address, roleAdmin);
    console.log("You are role admin:", isAdmin ? "✅ Can grant ORDER_KEEPER" : "❌ Cannot grant ORDER_KEEPER");
}

main().catch(console.error);