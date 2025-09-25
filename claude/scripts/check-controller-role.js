const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Checking CONTROLLER Role ===\n");
    console.log("Your address:", signer.address);

    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Check CONTROLLER role with correct hash
    const CONTROLLER = ethers.utils.id("CONTROLLER");
    console.log("\nCONTROLLER role hash:", CONTROLLER);
    
    const hasController = await roleStore.hasRole(signer.address, CONTROLLER);
    console.log("Has CONTROLLER role:", hasController ? "✅ YES" : "❌ NO");
    
    if (hasController) {
        console.log("\n✅ Great! With CONTROLLER role you can:");
        console.log("  1. Execute deposits directly via DepositHandler");
        console.log("  2. Grant yourself ORDER_KEEPER role if needed");
        console.log("  3. Access most protocol functions");
    }
    
    // Also check DepositHandler's CONTROLLER role
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const depositHandlerHasController = await roleStore.hasRole(DEPOSIT_HANDLER, CONTROLLER);
    console.log("\nDepositHandler has CONTROLLER:", depositHandlerHasController ? "✅ YES" : "❌ NO");
    
    if (!depositHandlerHasController) {
        console.log("⚠️  DepositHandler doesn't have CONTROLLER role - this might be an issue!");
    }
}

main().catch(console.error);