const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting RoleStore deployment...");
    
    // Get the deployer account - compatible with both ethers v5 and v6
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    
    if (!deployer) {
        throw new Error("No deployer account found. Check your network configuration.");
    }
    
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying with account:", deployerAddress);
    
    // Check balance
    const balance = await deployer.getBalance();
    console.log("Account balance:", ethers.utils ? ethers.utils.formatEther(balance) : ethers.formatEther(balance), "ETH");
    
    // Deploy RoleStore
    console.log("\n1. Deploying RoleStore...");
    const RoleStore = await ethers.getContractFactory("RoleStore");
    const roleStore = await RoleStore.deploy();
    
    // Wait for deployment - compatible with both ethers v5 and v6
    if (roleStore.deployed) {
        await roleStore.deployed(); // ethers v5
    } else if (roleStore.waitForDeployment) {
        await roleStore.waitForDeployment(); // ethers v6
    }
    
    // Get the address - compatible with both versions
    const roleStoreAddress = roleStore.address || (await roleStore.getAddress());
    console.log("✅ RoleStore deployed to:", roleStoreAddress);
    
    // Verify the deployer has ROLE_ADMIN
    console.log("\n2. Verifying initial permissions...");
    // Use keccak256 for role hash - compatible with both versions
    const ROLE_ADMIN = ethers.utils ? ethers.utils.id("ROLE_ADMIN") : ethers.id("ROLE_ADMIN");
    const hasAdminRole = await roleStore.hasRole(deployerAddress, ROLE_ADMIN);
    console.log("Deployer has ROLE_ADMIN:", hasAdminRole);
    
    // Get current block number
    const blockNumber = await ethers.provider.getBlockNumber();
    
    // Save deployment info
    const deploymentInfo = {
        network: "arbitrumSepolia",
        deployedAt: new Date().toISOString(),
        contracts: {
            RoleStore: {
                address: roleStoreAddress,
                deployer: deployerAddress,
                deploymentBlock: blockNumber,
                notes: "Initial deployment - deployer has ROLE_ADMIN"
            }
        }
    };
    
    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, "../../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    // Save to file
    const filePath = path.join(deploymentsDir, "marks-exchange-deployment.json");
    fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n✅ Deployment info saved to:", filePath);
    console.log("\n=== RoleStore Deployment Complete ===");
    console.log("Address:", roleStoreAddress);
    console.log("\nNext steps:");
    console.log("1. Save this address - you'll need it for deploying other contracts");
    console.log("2. Verify the contract on Arbiscan (optional but recommended)");
    console.log("3. Proceed with DataStore deployment");
    
    return roleStoreAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });