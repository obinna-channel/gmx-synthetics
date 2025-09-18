const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting DataStore deployment...");
    
    // Load previous deployment data
    const deploymentPath = path.join(__dirname, "../../deployments/marks-exchange-deployment.json");
    let deploymentData;
    
    try {
        deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        console.log("Loaded existing deployment data");
    } catch (error) {
        console.error("Could not load deployment file. Make sure RoleStore is deployed first.");
        process.exit(1);
    }
    
    const roleStoreAddress = deploymentData.contracts.RoleStore.address;
    console.log("Using RoleStore at:", roleStoreAddress);
    
    // Get the deployer account
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying with account:", deployerAddress);
    
    // Check balance
    const balance = await deployer.getBalance();
    console.log("Account balance:", ethers.utils ? ethers.utils.formatEther(balance) : ethers.formatEther(balance), "ETH");
    
    // Deploy DataStore
    console.log("\n1. Deploying DataStore...");
    const DataStore = await ethers.getContractFactory("DataStore");
    
    // DataStore constructor takes RoleStore address
    const dataStore = await DataStore.deploy(roleStoreAddress);
    
    // Wait for deployment
    if (dataStore.deployed) {
        await dataStore.deployed(); // ethers v5
    } else if (dataStore.waitForDeployment) {
        await dataStore.waitForDeployment(); // ethers v6
    }
    
    // Get the address
    const dataStoreAddress = dataStore.address || (await dataStore.getAddress());
    console.log("✅ DataStore deployed to:", dataStoreAddress);
    
    // Grant CONTROLLER role to DataStore if needed
    console.log("\n2. Setting up permissions...");
    const RoleStore = await ethers.getContractFactory("RoleStore");
    const roleStore = RoleStore.attach(roleStoreAddress);
    
    // DataStore needs CONTROLLER role to be modified by other contracts
    const CONTROLLER_ROLE = ethers.utils ? ethers.utils.id("CONTROLLER") : ethers.id("CONTROLLER");
    
    // Note: We'll grant this role later when we deploy ExchangeRouter and other controllers
    console.log("Note: CONTROLLER role will be granted to relevant contracts in later deployments");
    
    // Update deployment info
    const blockNumber = await ethers.provider.getBlockNumber();
    
    deploymentData.contracts.DataStore = {
        address: dataStoreAddress,
        deployer: deployerAddress,
        deploymentBlock: blockNumber,
        roleStoreAddress: roleStoreAddress,
        notes: "Central storage for all protocol configuration and state"
    };
    
    // Save updated deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    
    console.log("\n✅ Deployment info saved to:", deploymentPath);
    console.log("\n=== DataStore Deployment Complete ===");
    console.log("Address:", dataStoreAddress);
    console.log("\nKey points:");
    console.log("- DataStore will hold all market configuration");
    console.log("- Stores funding rates, borrowing fees, position limits");
    console.log("- Works perfectly with single-asset (USDT) collateral");
    console.log("\nNext steps:");
    console.log("1. Save this address - needed for EventEmitter and other contracts");
    console.log("2. Proceed with EventEmitter deployment");
    
    return dataStoreAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });