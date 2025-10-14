const { ethers } = require("hardhat");

async function main() {
    console.log("=== GRANTING KEEPER ROLES TO NEW KEEPER ADDRESS ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    // New dedicated keeper address
    const NEW_KEEPER_ADDRESS = "0xB9438AeD3ff32E30737268ae0f835217E79a76F5";

    console.log("New keeper address:", NEW_KEEPER_ADDRESS);

    // Get RoleStore
    const roleStore = await ethers.getContractAt("RoleStore", "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778");

    // Calculate role hashes
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );

    const FROZEN_ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["FROZEN_ORDER_KEEPER"])
    );

    console.log("\nRole hashes:");
    console.log("  ORDER_KEEPER:", ORDER_KEEPER);
    console.log("  FROZEN_ORDER_KEEPER:", FROZEN_ORDER_KEEPER);

    // Check current roles
    const hasOrderKeeper = await roleStore.hasRole(NEW_KEEPER_ADDRESS, ORDER_KEEPER);
    const hasFrozenOrderKeeper = await roleStore.hasRole(NEW_KEEPER_ADDRESS, FROZEN_ORDER_KEEPER);

    console.log("\nCurrent roles for new keeper:");
    console.log("  ORDER_KEEPER:", hasOrderKeeper);
    console.log("  FROZEN_ORDER_KEEPER:", hasFrozenOrderKeeper);

    // Grant ORDER_KEEPER role
    if (!hasOrderKeeper) {
        console.log("\n📝 Granting ORDER_KEEPER role...");
        const tx1 = await roleStore.grantRole(NEW_KEEPER_ADDRESS, ORDER_KEEPER);
        console.log("Transaction sent:", tx1.hash);
        const receipt1 = await tx1.wait();
        console.log("✅ ORDER_KEEPER role granted! Gas used:", receipt1.gasUsed.toString());
    } else {
        console.log("\n✅ ORDER_KEEPER role already granted");
    }

    // Grant FROZEN_ORDER_KEEPER role
    if (!hasFrozenOrderKeeper) {
        console.log("\n📝 Granting FROZEN_ORDER_KEEPER role...");
        const tx2 = await roleStore.grantRole(NEW_KEEPER_ADDRESS, FROZEN_ORDER_KEEPER);
        console.log("Transaction sent:", tx2.hash);
        const receipt2 = await tx2.wait();
        console.log("✅ FROZEN_ORDER_KEEPER role granted! Gas used:", receipt2.gasUsed.toString());
    } else {
        console.log("\n✅ FROZEN_ORDER_KEEPER role already granted");
    }

    // Verify all roles
    console.log("\n🔍 Verifying roles...");
    const hasOrderKeeperAfter = await roleStore.hasRole(NEW_KEEPER_ADDRESS, ORDER_KEEPER);
    const hasFrozenOrderKeeperAfter = await roleStore.hasRole(NEW_KEEPER_ADDRESS, FROZEN_ORDER_KEEPER);

    console.log("Final roles for", NEW_KEEPER_ADDRESS);
    console.log("  ORDER_KEEPER:", hasOrderKeeperAfter);
    console.log("  FROZEN_ORDER_KEEPER:", hasFrozenOrderKeeperAfter);

    if (hasOrderKeeperAfter && hasFrozenOrderKeeperAfter) {
        console.log("\n✅ SUCCESS! New keeper is ready to execute orders!");
        console.log("\nNext steps:");
        console.log("1. Fund the keeper address with ETH for gas");
        console.log("2. Update keeper/.env with UPDATER_PRIVATE_KEY=<new_keeper_private_key>");
        console.log("3. Restart the keeper");
    } else {
        console.log("\n⚠️ WARNING: Not all roles were granted successfully");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
