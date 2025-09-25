const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    
    const roleStoreAddr = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddr);
    
    // Check with BOTH possible hashes
    const correctHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    const wrongHash = ethers.utils.id("CONTROLLER");
    
    console.log("\nChecking CONTROLLER role with different hashes:");
    console.log("Correct hash (abi.encode):", correctHash);
    console.log("Wrong hash (direct):", wrongHash);
    
    const hasRoleCorrect = await roleStore.hasRole(deployer.address, correctHash);
    const hasRoleWrong = await roleStore.hasRole(deployer.address, wrongHash);
    
    console.log("\nResults:");
    console.log("Has role with correct hash:", hasRoleCorrect);
    console.log("Has role with wrong hash:", hasRoleWrong);
    
    // Let's also check if ANY roles are granted to the deployer
    console.log("\nChecking if deployer has ANY roles...");
    const commonRoles = ["ROLE_ADMIN", "TIMELOCK_ADMIN", "CONFIG_KEEPER", "ORDER_KEEPER", "MARKET_KEEPER"];
    
    for (const roleName of commonRoles) {
        const hash1 = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [roleName]));
        const hash2 = ethers.utils.id(roleName);
        const has1 = await roleStore.hasRole(deployer.address, hash1);
        const has2 = await roleStore.hasRole(deployer.address, hash2);
        if (has1 || has2) {
            console.log(`  ${roleName}: ${has1 ? "YES (correct hash)" : ""}${has2 ? "YES (wrong hash)" : ""}`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
