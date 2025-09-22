const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    
    // Contract addresses from your deployment
    const roleStoreAddr = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const dataStoreAddr = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    
    // Get contracts
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddr);
    const dataStore = await ethers.getContractAt("DataStore", dataStoreAddr);
    
    // Compute correct CONTROLLER role hash
    const CONTROLLER_ROLE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    console.log("CONTROLLER role hash:", CONTROLLER_ROLE);
    
    // Check if deployer has CONTROLLER role
    const hasRole = await roleStore.hasRole(deployer.address, CONTROLLER_ROLE);
    console.log("Deployer has CONTROLLER role:", hasRole);
    
    // Check DataStore's roleStore
    console.log("DataStore's RoleStore:", await dataStore.roleStore());
    
    // Try a simple write operation
    const testKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TEST_KEY"));
    console.log("\nAttempting to write to DataStore...");
    
    try {
        const tx = await dataStore.setUint(testKey, 123);
        await tx.wait();
        console.log("SUCCESS: Write operation succeeded!");
        
        const value = await dataStore.getUint(testKey);
        console.log("Value read back:", value.toString());
    } catch (error) {
        console.log("FAILED: Write operation failed");
        console.log("Error:", error.reason || error.message);
        
        // Decode the error if possible
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
