const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting EventEmitter deployment...");
    
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
    console.log("Using RoleStore at:", roleStoreAddress);
    
    // Get the deployer account
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying with account:", deployerAddress);
    
    // Check balance
    const balance = await deployer.getBalance();
    console.log("Account balance:", ethers.utils ? ethers.utils.formatEther(balance) : ethers.formatEther(balance), "ETH");
    
    // Deploy EventEmitter
    console.log("\n1. Deploying EventEmitter...");
    const EventEmitter = await ethers.getContractFactory("EventEmitter");
    
    // EventEmitter constructor takes RoleStore address
    const eventEmitter = await EventEmitter.deploy(roleStoreAddress);
    
    // Wait for deployment
    if (eventEmitter.deployed) {
        await eventEmitter.deployed(); // ethers v5
    } else if (eventEmitter.waitForDeployment) {
        await eventEmitter.waitForDeployment(); // ethers v6
    }
    
    // Get the address
    const eventEmitterAddress = eventEmitter.address || (await eventEmitter.getAddress());
    console.log("✅ EventEmitter deployed to:", eventEmitterAddress);
    
    // Update deployment info
    const blockNumber = await ethers.provider.getBlockNumber();
    
    deploymentData.contracts.EventEmitter = {
        address: eventEmitterAddress,
        deployer: deployerAddress,
        deploymentBlock: blockNumber,
        roleStoreAddress: roleStoreAddress,
        notes: "Centralized event logging for all protocol actions"
    };
    
    // Save updated deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    
    console.log("\n✅ Deployment info saved to:", deploymentPath);
    console.log("\n=== EventEmitter Deployment Complete ===");
    console.log("Address:", eventEmitterAddress);
    console.log("\nKey points:");
    console.log("- EventEmitter will log all trades and position changes");
    console.log("- Essential for keeper bots to monitor orders");
    console.log("- Frontend will use these events for real-time updates");
    console.log("- Works perfectly with single-asset collateral");
    console.log("\nNext steps:");
    console.log("1. Save this address - needed for Router and ExchangeRouter");
    console.log("2. Proceed with Router deployment");
    
    return eventEmitterAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });