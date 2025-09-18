const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting Router deployment...");
    
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
    
    // Deploy Router
    console.log("\n1. Deploying Router...");
    const Router = await ethers.getContractFactory("Router");
    
    // Router constructor takes RoleStore address
    const router = await Router.deploy(roleStoreAddress);
    
    // Wait for deployment
    if (router.deployed) {
        await router.deployed(); // ethers v5
    } else if (router.waitForDeployment) {
        await router.waitForDeployment(); // ethers v6
    }
    
    // Get the address
    const routerAddress = router.address || (await router.getAddress());
    console.log("✅ Router deployed to:", routerAddress);
    
    // Update deployment info
    const blockNumber = await ethers.provider.getBlockNumber();
    
    deploymentData.contracts.Router = {
        address: routerAddress,
        deployer: deployerAddress,
        deploymentBlock: blockNumber,
        roleStoreAddress: roleStoreAddress,
        notes: "Token transfer handler - manages all USDT movements"
    };
    
    // Save updated deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    
    console.log("\n✅ Deployment info saved to:", deploymentPath);
    console.log("\n=== Router Deployment Complete ===");
    console.log("Address:", routerAddress);
    console.log("\nKey points:");
    console.log("- Router will handle all USDT transfers");
    console.log("- Users will approve Router for USDT spending");
    console.log("- Simpler with single-asset (USDT only) system");
    console.log("- No token swapping complexity needed");
    console.log("\nNext steps:");
    console.log("1. Save this address - needed for ExchangeRouter");
    console.log("2. Proceed with OrderVault deployment");
    
    return routerAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });