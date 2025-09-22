const { ethers } = require("hardhat");

async function main() {
    console.log("=== GRANTING ORDER_KEEPER ROLE FOR DEPOSIT EXECUTION ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Account address:", deployer.address);

    // Get RoleStore
    const roleStore = await ethers.getContractAt("RoleStore", "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778");

    // Calculate ORDER_KEEPER role hash
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );

    console.log("ORDER_KEEPER role hash:", ORDER_KEEPER);

    // Check if deployer already has the role
    const hasRole = await roleStore.hasRole(deployer.address, ORDER_KEEPER);
    console.log("Account has ORDER_KEEPER role:", hasRole);

    if (!hasRole) {
        console.log("\nGranting ORDER_KEEPER role...");
        const tx = await roleStore.grantRole(deployer.address, ORDER_KEEPER);
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("✓ Role granted successfully! Gas used:", receipt.gasUsed.toString());

        // Verify
        const hasRoleAfter = await roleStore.hasRole(deployer.address, ORDER_KEEPER);
        console.log("Verification - Account has ORDER_KEEPER role:", hasRoleAfter);
    } else {
        console.log("✓ Account already has ORDER_KEEPER role");
    }

    console.log("\n✅ You can now execute deposits and withdrawals directly!");
}

main().catch(console.error);