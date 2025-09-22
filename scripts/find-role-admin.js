const { ethers } = require("hardhat");

async function main() {
    const roleStore = await ethers.getContractAt("RoleStore", "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C");
    const ROLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
    
    console.log("Checking RoleStore role members...");
    
    // Get role member count for ROLE_ADMIN
    try {
        const memberCount = await roleStore.getRoleMemberCount(ROLE_ADMIN);
        console.log("ROLE_ADMIN member count:", memberCount.toString());
        
        // Get members if count > 0
        for (let i = 0; i < memberCount; i++) {
            const member = await roleStore.getRoleMembers(ROLE_ADMIN, i, 1);
            console.log(`Member ${i}:`, member[0]);
        }
    } catch (e) {
        console.log("Could not get role member count - function might not exist");
    }
    
    // Let's check the RoleStore contract directly
    console.log("\n\nChecking if RoleStore contract itself has any admin...");
    
    // Check address(0)
    const hasRoleZero = await roleStore.hasRole(ethers.constants.AddressZero, ROLE_ADMIN);
    console.log("address(0) has ROLE_ADMIN?", hasRoleZero);
    
    // Check the RoleStore contract itself
    const hasRoleSelf = await roleStore.hasRole(roleStore.address, ROLE_ADMIN);
    console.log("RoleStore contract has ROLE_ADMIN?", hasRoleSelf);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
