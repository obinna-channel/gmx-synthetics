const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting OrderVault deployment...");
    
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
    const dataStoreAddress = deploymentData.contracts.DataStore.address;
    console.log("Using RoleStore at:", roleStoreAddress);
    console.log("Using DataStore at:", dataStoreAddress);
    
    // Get the deployer account
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying with account:", deployerAddress);
    
    // Check balance
    const balance = await deployer.getBalance();
    console.log("Account balance:", ethers.utils ? ethers.utils.formatEther(balance) : ethers.formatEther(balance), "ETH");
    
    // Deploy OrderVault
    console.log("\n1. Deploying OrderVault...");
    const OrderVault = await ethers.getContractFactory("OrderVault");
    
    // OrderVault constructor takes RoleStore and DataStore addresses
    const orderVault = await OrderVault.deploy(roleStoreAddress, dataStoreAddress);
    
    // Wait for deployment
    if (orderVault.deployed) {
        await orderVault.deployed(); // ethers v5
    } else if (orderVault.waitForDeployment) {
        await orderVault.waitForDeployment(); // ethers v6
    }
    
    // Get the address
    const orderVaultAddress = orderVault.address || (await orderVault.getAddress());
    console.log("✅ OrderVault deployed to:", orderVaultAddress);
    
    // Update deployment info
    const blockNumber = await ethers.provider.getBlockNumber();
    
    deploymentData.contracts.OrderVault = {
        address: orderVaultAddress,
        deployer: deployerAddress,
        deploymentBlock: blockNumber,
        roleStoreAddress: roleStoreAddress,
        dataStoreAddress: dataStoreAddress,
        notes: "Secure vault for holding USDT during order execution"
    };
    
    // Save updated deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    
    console.log("\n✅ Deployment info saved to:", deploymentPath);
    console.log("\n=== OrderVault Deployment Complete ===");
    console.log("Address:", orderVaultAddress);
    console.log("\nKey points:");
    console.log("- OrderVault will hold USDT during trades");
    console.log("- Acts as escrow for pending orders");
    console.log("- Simpler with single-asset system");
    console.log("- Critical for limit/stop order collateral");
    console.log("\n🎉 Day 1 Morning Complete!");
    console.log("All base infrastructure contracts deployed:");
    console.log("  ✅ RoleStore");
    console.log("  ✅ DataStore"); 
    console.log("  ✅ EventEmitter");
    console.log("  ✅ Router");
    console.log("  ✅ OrderVault");
    console.log("\nNext steps:");
    console.log("1. Take a break!");
    console.log("2. Next is ExchangeRouter (Day 1 Afternoon)");
    console.log("3. This will be the main entry point for users");
    
    return orderVaultAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });