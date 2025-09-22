const { ethers } = require("hardhat");

async function main() {
    const roleStore = await ethers.getContractAt("RoleStore", "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C");
    
    // Check total role count
    const roleCount = await roleStore.getRoleCount();
    console.log("Total number of roles in system:", roleCount.toString());
    
    if (roleCount > 0) {
        console.log("\nRoles in the system:");
        const roles = await roleStore.getRoles(0, roleCount);
        for (const role of roles) {
            console.log("Role hash:", role);
            
            // Get member count for this role
            const memberCount = await roleStore.getRoleMemberCount(role);
            console.log("  Member count:", memberCount.toString());
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
