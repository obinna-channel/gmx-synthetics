const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Granting CONTROLLER role to deployer...");
    
    // Load deployment data
    const deploymentPath = path.join(__dirname, "../../deployments/marks-exchange-deployment.json");
    const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    const roleStoreAddress = deploymentData.contracts.RoleStore.address;
    const oracleStoreAddress = deploymentData.contracts.OracleStore.address;
    
    // Get the deployer account
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const deployerAddress = await deployer.getAddress();
    
    console.log("Deployer address:", deployerAddress);
    console.log("RoleStore address:", roleStoreAddress);
    console.log("OracleStore address:", oracleStoreAddress);
    
    // Get RoleStore contract
    const RoleStore = await ethers.getContractFactory("RoleStore");
    const roleStore = RoleStore.attach(roleStoreAddress);
    
    // Grant CONTROLLER role
    const CONTROLLER_ROLE = ethers.utils ? ethers.utils.id("CONTROLLER") : ethers.id("CONTROLLER");
    console.log("\nGranting CONTROLLER role to deployer...");
    
    const grantRoleTx = await roleStore.grantRole(deployerAddress, CONTROLLER_ROLE);
    await grantRoleTx.wait();
    console.log("✅ Granted CONTROLLER role to deployer");
    
    // Now add signer to OracleStore
    console.log("\nAdding deployer as oracle signer...");
    const OracleStore = await ethers.getContractFactory("OracleStore");
    const oracleStore = OracleStore.attach(oracleStoreAddress);
    
    const addSignerTx = await oracleStore.addSigner(deployerAddress);
    await addSignerTx.wait();
    console.log("✅ Added deployer as oracle signer");
    
    console.log("\n=== Configuration Complete ===");
    console.log("OracleStore is now configured with single signer");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Failed:", error);
        process.exit(1);
    });