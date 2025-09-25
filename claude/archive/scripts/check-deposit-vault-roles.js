const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING DEPOSITVAULT CONTROLLER ROLES ===\n");

    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    
    // DepositVault has its own role store
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    
    // Get the roleStore from DepositVault
    const roleStoreAddress = await depositVault.roleStore();
    console.log("DepositVault's RoleStore:", roleStoreAddress);
    
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);
    
    const CONTROLLER = ethers.utils.id("CONTROLLER");
    
    // Check if DepositHandler has CONTROLLER on DepositVault
    const hasRole = await roleStore.hasRole(DEPOSIT_HANDLER, CONTROLLER);
    console.log("\nDepositHandler has CONTROLLER role on DepositVault:", hasRole);
    
    if (!hasRole) {
        console.log("\n❌ THIS IS THE PROBLEM!");
        console.log("DepositHandler needs CONTROLLER role on DepositVault");
        console.log("to call recordTransferIn() when creating deposits.\n");
        
        console.log("Granting CONTROLLER role to DepositHandler...");
        try {
            const tx = await roleStore.grantRole(DEPOSIT_HANDLER, CONTROLLER);
            await tx.wait();
            console.log("✅ Granted CONTROLLER role to DepositHandler!");
        } catch (e) {
            console.log("Error granting role:", e.message);
        }
    }
}

main().catch(console.error);
