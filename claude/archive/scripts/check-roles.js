const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    
    const roleStoreAddr = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddr);
    
    // Check with BOTH possible hashes for CONTROLLER
    const correctHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    const wrongHash = ethers.utils.id("CONTROLLER");
    
    console.log("\nChecking CONTROLLER role:");
    console.log("Correct hash (abi.encode):", correctHash);
    console.log("Wrong hash (direct):", wrongHash);
    
    const hasCorrect = await roleStore.hasRole(deployer.address, correctHash);
    const hasWrong = await roleStore.hasRole(deployer.address, wrongHash);
    
    console.log("\nDeployer has CONTROLLER role:");
    console.log("  With correct hash:", hasCorrect);
    console.log("  With wrong hash:", hasWrong);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
