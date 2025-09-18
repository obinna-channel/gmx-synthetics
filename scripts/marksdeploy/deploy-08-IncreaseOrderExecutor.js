const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("=== Phase 3: Starting IncreaseOrderExecutor deployment ===\n");
    
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
    
    // Get required addresses
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
    
    // Deploy IncreaseOrderExecutor
    console.log("\n1. Deploying IncreaseOrderExecutor...");
    const IncreaseOrderExecutor = await ethers.getContractFactory("IncreaseOrderExecutor");
    
    // IncreaseOrderExecutor constructor only takes RoleStore address
    const increaseOrderExecutor = await IncreaseOrderExecutor.deploy(roleStoreAddress);
    
    // Wait for deployment
    if (increaseOrderExecutor.deployed) {
        await increaseOrderExecutor.deployed(); // ethers v5
    } else if (increaseOrderExecutor.waitForDeployment) {
        await increaseOrderExecutor.waitForDeployment(); // ethers v6
    }
    
    // Get the address
    const increaseOrderExecutorAddress = increaseOrderExecutor.address || (await increaseOrderExecutor.getAddress());
    console.log("✅ IncreaseOrderExecutor deployed to:", increaseOrderExecutorAddress);
    
    // Grant CONTROLLER role to the executor
    console.log("\n2. Setting up permissions...");
    const RoleStore = await ethers.getContractFactory("RoleStore");
    const roleStore = RoleStore.attach(roleStoreAddress);
    
    // Use the correct CONTROLLER role hash from GMX
    const CONTROLLER_ROLE = "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b";
    
    // Check if already has role
    const hasRole = await roleStore.hasRole(increaseOrderExecutorAddress, CONTROLLER_ROLE);
    
    if (!hasRole) {
        console.log("Granting CONTROLLER role to IncreaseOrderExecutor...");
        const tx = await roleStore.grantRole(increaseOrderExecutorAddress, CONTROLLER_ROLE);
        await tx.wait();
        console.log("✅ CONTROLLER role granted to IncreaseOrderExecutor");
    } else {
        console.log("✅ IncreaseOrderExecutor already has CONTROLLER role");
    }
    
    // Update deployment info
    const blockNumber = await ethers.provider.getBlockNumber();
    
    deploymentData.contracts.IncreaseOrderExecutor = {
        address: increaseOrderExecutorAddress,
        deployer: deployerAddress,
        deploymentBlock: blockNumber,
        roleStoreAddress: roleStoreAddress,
        notes: "Handles execution of increase orders (opening/increasing positions)"
    };
    
    // Save updated deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    
    console.log("\n✅ Deployment info saved to:", deploymentPath);
    console.log("\n=== IncreaseOrderExecutor Deployment Complete ===");
    console.log("Address:", increaseOrderExecutorAddress);
    
    console.log("\nKey points:");
    console.log("- Handles opening new positions (both long and short)");
    console.log("- Handles increasing existing position sizes");
    console.log("- Works perfectly with USDT-only collateral");
    console.log("- Thin wrapper that delegates to IncreaseOrderUtils");
    
    console.log("\nNext steps:");
    console.log("1. Deploy DecreaseOrderExecutor (deploy-09)");
    console.log("2. Deploy SwapOrderExecutor (deploy-10)");
    console.log("3. Then deploy OrderHandler with all three executor addresses");
    
    return increaseOrderExecutorAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });