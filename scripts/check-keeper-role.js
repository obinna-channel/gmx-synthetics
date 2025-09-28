const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Checking ORDER_KEEPER Role ===\n");
    console.log("Checking address:", signer.address);

    // Contract addresses from deployments
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB"; // From RoleStore.json
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Calculate the ORDER_KEEPER role hash correctly
    // From Role.sol: bytes32 public constant ORDER_KEEPER = keccak256(abi.encode("ORDER_KEEPER"));
    const ORDER_KEEPER_ROLE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );

    console.log("ORDER_KEEPER role hash:", ORDER_KEEPER_ROLE);

    // Check if the signer has the ORDER_KEEPER role
    const hasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER_ROLE);

    console.log("\n📊 Role Check Result:");
    console.log(`   ${signer.address} has ORDER_KEEPER role: ${hasRole ? "✅ YES" : "❌ NO"}`);

    if (!hasRole) {
        console.log("\n⚠️  To grant ORDER_KEEPER role, the admin needs to run:");
        console.log(`   await roleStore.grantRole(\"${signer.address}\", \"${ORDER_KEEPER_ROLE}\")`);

        // Let's also check CONTROLLER role to see who can grant roles
        const CONTROLLER_ROLE = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
        );

        // Check if OrderHandler has CONTROLLER role (it needs it to execute)
        const ORDER_HANDLER = "0x83f2D66af7f794893C31c0B32BD2D4cE826871d7";
        const orderHandlerHasController = await roleStore.hasRole(ORDER_HANDLER, CONTROLLER_ROLE);

        console.log("\n📋 Other role checks:");
        console.log(`   OrderHandler has CONTROLLER role: ${orderHandlerHasController ? "✅ YES" : "❌ NO"}`);
    }

    // Let's also check for FROZEN_ORDER_KEEPER role
    const FROZEN_ORDER_KEEPER_ROLE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["FROZEN_ORDER_KEEPER"])
    );

    const hasFrozenRole = await roleStore.hasRole(signer.address, FROZEN_ORDER_KEEPER_ROLE);
    console.log(`   ${signer.address} has FROZEN_ORDER_KEEPER role: ${hasFrozenRole ? "✅ YES" : "❌ NO"}`);

    // Check role admin
    console.log("\n🔐 Role Admin Info:");
    const roleAdmin = await roleStore.getRoleAdmin(ORDER_KEEPER_ROLE);
    console.log("   ORDER_KEEPER role admin:", roleAdmin);

    // Check if we are the admin
    const isAdmin = await roleStore.hasRole(signer.address, roleAdmin);
    console.log(`   ${signer.address} is role admin: ${isAdmin ? "✅ YES" : "❌ NO"}`);

    if (isAdmin) {
        console.log("\n✨ You can grant yourself the ORDER_KEEPER role!");
    }
}

main().catch(console.error);