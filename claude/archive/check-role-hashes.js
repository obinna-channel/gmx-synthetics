const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Role Hash Calculations ===\n");
    
    // Calculate what we think the hashes should be
    const roles = [
        "ROLE_ADMIN",
        "CONTROLLER",
        "CONFIG_KEEPER",
        "ORDER_KEEPER",
        "ADL_KEEPER",
        "LIQUIDATION_KEEPER",
        "MARKET_KEEPER",
        "FROZEN_ORDER_KEEPER",
        "TIMELOCK_ADMIN"
    ];
    
    console.log("Expected role hashes (using keccak256 of role name):");
    console.log("=====================================================");
    for (const role of roles) {
        const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role));
        console.log(role + " => " + hash);
    }
    
    // Now check what roles actually exist in RoleStore
    console.log("\n\nActual roles in RoleStore:");
    console.log("===========================");
    
    const roleStore = await ethers.getContractAt("RoleStore", "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C");
    const roleCount = await roleStore.getRoleCount();
    
    if (roleCount > 0) {
        const actualRoles = await roleStore.getRoles(0, roleCount);
        for (const roleHash of actualRoles) {
            const memberCount = await roleStore.getRoleMemberCount(roleHash);
            console.log(roleHash + " (" + memberCount + " members)");
            
            // Check if this matches any of our expected hashes
            for (const role of roles) {
                const expectedHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role));
                if (expectedHash === roleHash) {
                    console.log("  ^ This is " + role);
                }
            }
        }
    }
    
    // Check the actual constants used in the contracts
    console.log("\n\nLet me check what hash the contracts are actually using...");
    console.log("===========================================================");
    
    // Try to grant a role to see what hash is being used
    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);
    
    // Check if signer has each role using different hash methods
    const roleAdminSimple = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
    const hasRoleSimple = await roleStore.hasRole(signer.address, roleAdminSimple);
    console.log("\nUsing simple keccak256('ROLE_ADMIN'):", roleAdminSimple);
    console.log("Signer has this role?", hasRoleSimple);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
