const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Granting ORDER_KEEPER Role ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";

    // Get RoleStore contract
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Compute ORDER_KEEPER role hash using correct method
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );

    console.log("ORDER_KEEPER role hash:", ORDER_KEEPER);

    // Check if we already have the role
    const hasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
    console.log("Current ORDER_KEEPER status:", hasRole);

    if (!hasRole) {
        console.log("\nGranting ORDER_KEEPER role...");
        try {
            const tx = await roleStore.grantRole(signer.address, ORDER_KEEPER);
            console.log("Transaction sent:", tx.hash);
            await tx.wait();
            console.log("✅ ORDER_KEEPER role granted!");

            // Verify the role was granted
            const hasRoleAfter = await roleStore.hasRole(signer.address, ORDER_KEEPER);
            console.log("ORDER_KEEPER status after grant:", hasRoleAfter);
        } catch (error) {
            console.log("❌ Error granting role:", error.message);
        }
    } else {
        console.log("✅ Account already has ORDER_KEEPER role");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });