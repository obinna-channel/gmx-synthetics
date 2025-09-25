const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Granting ORDER_KEEPER Role ===\n");
    console.log("Your address:", signer.address);
    
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    // ORDER_KEEPER role hash
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );
    
    console.log("ORDER_KEEPER role hash:", ORDER_KEEPER);
    
    // Check current status
    const hasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
    console.log("\nCurrent status: You have ORDER_KEEPER role:", hasRole ? "✅" : "❌");
    
    if (hasRole) {
        console.log("\n✅ You already have ORDER_KEEPER role!");
        return;
    }
    
    // Grant the role
    console.log("\n📝 Granting ORDER_KEEPER role...");
    console.log("This allows you to execute deposits, orders, and withdrawals.");
    
    try {
        const tx = await roleStore.grantRole(signer.address, ORDER_KEEPER);
        console.log("\nTransaction sent:", tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("\nTransaction confirmed in block:", receipt.blockNumber);
        
        // Verify the role was granted
        const nowHasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
        if (nowHasRole) {
            console.log("\n✅ SUCCESS! You now have ORDER_KEEPER role!");
            console.log("You can now execute deposits.");
        } else {
            console.log("\n❌ Role grant transaction succeeded but role not set?");
        }
        
    } catch (error) {
        console.log("\n❌ Failed to grant ORDER_KEEPER role:", error.message);
        
        if (error.message.includes("Unauthorized")) {
            console.log("\n⚠️  You need ROLE_ADMIN privileges to grant roles.");
            console.log("Since you have CONTROLLER role, you should be able to grant this.");
        }
    }
}

main().catch(console.error);