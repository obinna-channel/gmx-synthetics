const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Checking LIQUIDATION_KEEPER Role ===\n");
    console.log("Checking address:", signer.address);

    // Contract addresses
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Calculate the LIQUIDATION_KEEPER role hash
    const LIQUIDATION_KEEPER_ROLE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["LIQUIDATION_KEEPER"])
    );

    console.log("LIQUIDATION_KEEPER role hash:", LIQUIDATION_KEEPER_ROLE);

    // Check if the signer has the LIQUIDATION_KEEPER role
    const hasRole = await roleStore.hasRole(signer.address, LIQUIDATION_KEEPER_ROLE);

    console.log("\n📊 Role Check Result:");
    console.log(`   ${signer.address} has LIQUIDATION_KEEPER role: ${hasRole ? "✅ YES" : "❌ NO"}`);

    if (!hasRole) {
        console.log("\n⚠️  You need LIQUIDATION_KEEPER role to execute liquidations");

        // Check if we are admin
        const roleAdmin = await roleStore.getRoleAdmin(LIQUIDATION_KEEPER_ROLE);
        console.log("\n🔐 Role Admin Info:");
        console.log("   LIQUIDATION_KEEPER role admin:", roleAdmin);

        const isAdmin = await roleStore.hasRole(signer.address, roleAdmin);
        console.log(`   ${signer.address} is role admin: ${isAdmin ? "✅ YES" : "❌ NO"}`);

        if (isAdmin) {
            console.log("\n✨ You can grant yourself the LIQUIDATION_KEEPER role!");
            console.log("   Run: npx hardhat run scripts/grantLiquidationKeeperRole.js --network arbitrumSepolia");
        }
    } else {
        console.log("\n✅ You have permission to execute liquidations!");
    }
}

main().catch(console.error);
