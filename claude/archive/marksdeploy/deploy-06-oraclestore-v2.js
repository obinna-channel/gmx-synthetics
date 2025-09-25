const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting OracleStore deployment (v2 - with proper permissions)...");
    console.log("This will store oracle configuration for price feeds\n");
    
    // Load previous deployment data
    const deploymentPath = path.join(__dirname, "../../deployments/marks-exchange-deployment.json");
    let deploymentData;
    
    try {
        deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        console.log("Loaded existing deployment data");
    } catch (error) {
        console.error("Could not load deployment file. Make sure previous contracts are deployed.");
        process.exit(1);
    }
    
    const roleStoreAddress = deploymentData.contracts.RoleStore.address;
    const eventEmitterAddress = deploymentData.contracts.EventEmitter.address;
    
    console.log("Using RoleStore at:", roleStoreAddress);
    console.log("Using EventEmitter at:", eventEmitterAddress);
    
    // Get the deployer account
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying with account:", deployerAddress);
    
    // Check balance
    const balance = await deployer.getBalance();
    console.log("Account balance:", ethers.utils ? ethers.utils.formatEther(balance) : ethers.formatEther(balance), "ETH");
    
    // STEP 1: Grant CONTROLLER role to deployer FIRST
    console.log("\n1. Granting CONTROLLER role to deployer...");
    const RoleStore = await ethers.getContractFactory("RoleStore");
    const roleStore = RoleStore.attach(roleStoreAddress);
    
    const CONTROLLER_ROLE = ethers.utils ? ethers.utils.id("CONTROLLER") : ethers.id("CONTROLLER");
    const grantRoleTx = await roleStore.grantRole(deployerAddress, CONTROLLER_ROLE);
    await grantRoleTx.wait();
    console.log("✅ Granted CONTROLLER role to deployer");
    
    // STEP 2: Deploy OracleStore
    console.log("\n2. Deploying OracleStore...");
    const OracleStore = await ethers.getContractFactory("OracleStore");
    
    // OracleStore constructor takes RoleStore and EventEmitter
    const oracleStore = await OracleStore.deploy(roleStoreAddress, eventEmitterAddress);
    
    // Wait for deployment
    if (oracleStore.deployed) {
        await oracleStore.deployed(); // ethers v5
    } else if (oracleStore.waitForDeployment) {
        await oracleStore.waitForDeployment(); // ethers v6
    }
    
    // Get the address
    const oracleStoreAddress = oracleStore.address || (await oracleStore.getAddress());
    console.log("✅ OracleStore deployed to:", oracleStoreAddress);
    
    // STEP 3: Configure OracleStore with single signer
    console.log("\n3. Configuring OracleStore...");
    
    // Add deployer as the single oracle signer for MVP
    const addSignerTx = await oracleStore.addSigner(deployerAddress);
    await addSignerTx.wait();
    console.log("✅ Added deployer as oracle signer:", deployerAddress);
    
    // Update deployment info
    const blockNumber = await ethers.provider.getBlockNumber();
    
    deploymentData.contracts.OracleStore = {
        address: oracleStoreAddress,
        deployer: deployerAddress,
        deploymentBlock: blockNumber,
        roleStoreAddress: roleStoreAddress,
        eventEmitterAddress: eventEmitterAddress,
        signers: [deployerAddress],
        notes: "Oracle configuration store with single signer for MVP - deployer has CONTROLLER role"
    };
    
    // Save updated deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    
    console.log("\n✅ Deployment info saved to:", deploymentPath);
    console.log("\n=== OracleStore Deployment Complete ===");
    console.log("Address:", oracleStoreAddress);
    console.log("\nKey configuration:");
    console.log("- Single signer setup (MVP mode)");
    console.log("- Signer address:", deployerAddress);
    console.log("- Deployer has CONTROLLER role for configuration");
    console.log("\nNext steps:");
    console.log("1. Deploy Oracle contract");
    console.log("2. Oracle will read signer config from this OracleStore");
    
    return oracleStoreAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });