const { ethers } = require("hardhat");

async function main() {
    console.log("=== CORRECT Role Hash Check ===\n");
    
    // The CORRECT way (from Role.sol) - using abi.encode
    const ROLE_ADMIN_CORRECT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ROLE_ADMIN"])
    );
    
    // The WRONG way (from deployment scripts) - using toUtf8Bytes
    const ROLE_ADMIN_WRONG = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("ROLE_ADMIN")
    );
    
    console.log("CORRECT hash (abi.encode):", ROLE_ADMIN_CORRECT);
    console.log("WRONG hash (toUtf8Bytes):", ROLE_ADMIN_WRONG);
    console.log("Hash from Role.sol:", "0x56908b85b56869d7c69cd020749874f238259af9646ca930287866cdd660b7d9");
    
    const roleStore = await ethers.getContractAt("RoleStore", "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C");
    const [signer] = await ethers.getSigners();
    
    console.log("\n\nChecking who has ROLE_ADMIN with CORRECT hash:");
    console.log("================================================");
    
    const hasCorrectRole = await roleStore.hasRole(signer.address, ROLE_ADMIN_CORRECT);
    console.log("Your address has ROLE_ADMIN (correct hash)?", hasCorrectRole);
    
    // Check the member count
    const memberCount = await roleStore.getRoleMemberCount(ROLE_ADMIN_CORRECT);
    console.log("Total members with ROLE_ADMIN:", memberCount.toString());
    
    // If there are members, list them
    if (memberCount > 0) {
        const members = await roleStore.getRoleMembers(ROLE_ADMIN_CORRECT, 0, memberCount);
        console.log("\nMembers with ROLE_ADMIN:");
        for (const member of members) {
            console.log(" -", member);
            if (member.toLowerCase() === signer.address.toLowerCase()) {
                console.log("   ^ That's you!");
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
