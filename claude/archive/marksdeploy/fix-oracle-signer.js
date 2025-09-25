const { ethers } = require("hardhat");

async function main() {
    console.log("Fixing OracleStore signer permissions...\n");
    
    // Contract addresses
    const roleStoreAddress = "0x81FBD321168655914C895ec63583140aB3eB2341";
    const oracleStoreAddress = "0x8644aB2924A5Be1bD6389aA4593dbB277089cD1E";
    const deployerAddress = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    
    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Current signer:", signer.address);
    
    // Get RoleStore contract
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);
    
    // CORRECT CONTROLLER role hash (from GMX's Role.sol)
    // This is keccak256(abi.encode("CONTROLLER"))
    const CONTROLLER_ROLE_CORRECT = "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b";
    
    // Check if deployer has the CORRECT role
    console.log("=== CHECKING CORRECT ROLE ===");
    console.log("Correct CONTROLLER role hash:", CONTROLLER_ROLE_CORRECT);
    
    const hasCorrectRole = await roleStore.hasRole(deployerAddress, CONTROLLER_ROLE_CORRECT);
    console.log("Deployer has CORRECT CONTROLLER role:", hasCorrectRole);
    
    if (!hasCorrectRole) {
        console.log("\n=== GRANTING CORRECT CONTROLLER ROLE ===");
        
        // We need to grant the correct role
        // First check if we have ROLE_ADMIN privileges
        const ROLE_ADMIN = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ROLE_ADMIN"]));
        const hasRoleAdmin = await roleStore.hasRole(signer.address, ROLE_ADMIN);
        console.log("Signer has ROLE_ADMIN:", hasRoleAdmin);
        
        if (!hasRoleAdmin) {
            console.log("\n❌ Cannot grant CONTROLLER role - signer doesn't have ROLE_ADMIN");
            console.log("You need to grant ROLE_ADMIN to", signer.address, "first");
            return;
        }
        
        // Grant the correct CONTROLLER role
        console.log("Granting CONTROLLER role to deployer...");
        const tx = await roleStore.grantRole(deployerAddress, CONTROLLER_ROLE_CORRECT);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ CONTROLLER role granted!");
        
        // Verify
        const nowHasRole = await roleStore.hasRole(deployerAddress, CONTROLLER_ROLE_CORRECT);
        console.log("Verification - Deployer now has CONTROLLER role:", nowHasRole);
    }
    
    // Now try to add signer to OracleStore
    console.log("\n=== ADDING SIGNER TO ORACLESTORE ===");
    const oracleStore = await ethers.getContractAt("OracleStore", oracleStoreAddress);
    
    try {
        console.log("Adding signer:", deployerAddress);
        const tx = await oracleStore.addSigner(deployerAddress);
        console.log("Transaction hash:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("✅ Signer added successfully!");
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Verify
        const signerCount = await oracleStore.getSignerCount();
        console.log("New signer count:", signerCount.toString());
        
        const firstSigner = await oracleStore.getSigner(0);
        console.log("First signer:", firstSigner);
        
    } catch (error) {
        console.log("❌ Error adding signer:", error.message);
        
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