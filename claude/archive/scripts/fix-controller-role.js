const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Fixing CONTROLLER role for deployer:", deployer.address);
    
    const roleStoreAddr = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddr);
    
    // Correct hash that contracts expect
    const correctHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    
    console.log("\nCorrect CONTROLLER hash:", correctHash);
    
    // Check current status
    const hasCorrectRole = await roleStore.hasRole(deployer.address, correctHash);
    
    if (hasCorrectRole) {
        console.log("✓ Deployer already has the correct CONTROLLER role!");
        return;
    }
    
    console.log("✗ Deployer does NOT have the correct CONTROLLER role");
    console.log("\nGranting correct CONTROLLER role...");
    
    try {
        const tx = await roleStore.grantRole(deployer.address, correctHash);
        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✓ Transaction confirmed in block:", receipt.blockNumber);
        
        // Verify it worked
        const nowHasRole = await roleStore.hasRole(deployer.address, correctHash);
        if (nowHasRole) {
            console.log("\n✓ SUCCESS! Deployer now has the correct CONTROLLER role");
        } else {
            console.log("\n✗ ERROR: Role grant succeeded but verification failed");
        }
    } catch (error) {
        console.log("\n✗ ERROR granting role:", error.reason || error.message);
        console.log("\nThis might mean you don't have ROLE_ADMIN permission.");
        console.log("You may need to use an account that already has ROLE_ADMIN.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
