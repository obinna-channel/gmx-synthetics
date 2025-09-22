const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    const roleStore = await ethers.getContractAt("RoleStore", "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C");
    
    // CORRECT way to calculate CONTROLLER hash (matches Role.sol)
    const CONTROLLER_CORRECT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    
    console.log("CONTROLLER hash (correct):", CONTROLLER_CORRECT);
    console.log("Expected from Role.sol:    0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b");
    console.log("Match?", CONTROLLER_CORRECT === "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b");
    
    const hasController = await roleStore.hasRole(signer.address, CONTROLLER_CORRECT);
    console.log("\nYour address:", signer.address);
    console.log("Has CONTROLLER role?", hasController ? "✅ YES" : "❌ NO");
    
    // Check member count
    const memberCount = await roleStore.getRoleMemberCount(CONTROLLER_CORRECT);
    console.log("\nTotal addresses with CONTROLLER:", memberCount.toString());
    
    if (memberCount > 0) {
        const members = await roleStore.getRoleMembers(CONTROLLER_CORRECT, 0, Math.min(memberCount, 10));
        console.log("CONTROLLER members:");
        for (const member of members) {
            console.log(" -", member, member.toLowerCase() === signer.address.toLowerCase() ? "(YOU)" : "");
        }
    }
}

main().catch(console.error);
