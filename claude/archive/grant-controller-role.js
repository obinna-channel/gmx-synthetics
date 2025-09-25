const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Granting CONTROLLER Role ===\n");
    console.log("Your address:", signer.address);
    
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    // Calculate role hashes using the CORRECT method (abi.encode)
    const ROLE_ADMIN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ROLE_ADMIN"])
    );
    const CONTROLLER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    
    console.log("CONTROLLER hash:", CONTROLLER);
    
    // First verify you have ROLE_ADMIN
    const hasRoleAdmin = await roleStore.hasRole(signer.address, ROLE_ADMIN);
    if (!hasRoleAdmin) {
        console.error("❌ ERROR: You don't have ROLE_ADMIN!");
        console.error("Cannot grant CONTROLLER role without ROLE_ADMIN.");
        process.exit(1);
    }
    console.log("✅ You have ROLE_ADMIN\n");
    
    // Check if you already have CONTROLLER
    const hasController = await roleStore.hasRole(signer.address, CONTROLLER);
    if (hasController) {
        console.log("✅ You already have CONTROLLER role!");
        return;
    }
    
    // Grant CONTROLLER role
    console.log("Granting CONTROLLER role to your address...");
    const tx = await roleStore.grantRole(signer.address, CONTROLLER);
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
    // Verify the role was granted
    const hasControllerAfter = await roleStore.hasRole(signer.address, CONTROLLER);
    if (hasControllerAfter) {
        console.log("\n✅ SUCCESS! You now have CONTROLLER role!");
    } else {
        console.log("\n❌ Something went wrong - role not granted");
    }
    
    // Show member count
    const memberCount = await roleStore.getRoleMemberCount(CONTROLLER);
    console.log("\nTotal addresses with CONTROLLER role:", memberCount.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error.message);
        process.exit(1);
    });
