const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting Oracle deployment...");
    console.log("This is the main price oracle for all markets\n");
    
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
    const oracleStoreAddress = deploymentData.contracts.OracleStore.address;
    
    console.log("Using RoleStore at:", roleStoreAddress);
    console.log("Using OracleStore at:", oracleStoreAddress);
    
    // Get the deployer account
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying with account:", deployerAddress);
    
    // Check balance
    const balance = await deployer.getBalance();
    console.log("Account balance:", ethers.utils ? ethers.utils.formatEther(balance) : ethers.formatEther(balance), "ETH");
    
    // Deploy Oracle
    console.log("\n1. Deploying Oracle...");
    const Oracle = await ethers.getContractFactory("Oracle");
    
    // Oracle constructor takes RoleStore and OracleStore
    const oracle = await Oracle.deploy(roleStoreAddress, oracleStoreAddress);
    
    // Wait for deployment
    if (oracle.deployed) {
        await oracle.deployed(); // ethers v5
    } else if (oracle.waitForDeployment) {
        await oracle.waitForDeployment(); // ethers v6
    }
    
    // Get the address
    const oracleAddress = oracle.address || (await oracle.getAddress());
    console.log("✅ Oracle deployed to:", oracleAddress);
    
    // Grant CONTROLLER role to the Oracle (it needs this to validate prices)
    console.log("\n2. Setting up permissions...");
    const RoleStore = await ethers.getContractFactory("RoleStore");
    const roleStore = RoleStore.attach(roleStoreAddress);
    
    const CONTROLLER_ROLE = ethers.utils ? ethers.utils.id("CONTROLLER") : ethers.id("CONTROLLER");
    const grantRoleTx = await roleStore.grantRole(oracleAddress, CONTROLLER_ROLE);
    await grantRoleTx.wait();
    console.log("✅ Granted CONTROLLER role to Oracle");
    
    // Update deployment info
    const blockNumber = await ethers.provider.getBlockNumber();
    
    // Define token mappings for reference
    const tokenMappings = {
        NGN: "0x0000000000000000000000000000000000000001",
        ARS: "0x0000000000000000000000000000000000000002", 
        PKR: "0x0000000000000000000000000000000000000003",
        GHS: "0x0000000000000000000000000000000000000004",
        COP: "0x0000000000000000000000000000000000000008"   
    };
    
    deploymentData.contracts.Oracle = {
        address: oracleAddress,
        deployer: deployerAddress,
        deploymentBlock: blockNumber,
        roleStoreAddress: roleStoreAddress,
        oracleStoreAddress: oracleStoreAddress,
        tokenMappings: tokenMappings,
        notes: "Main price oracle for all FX markets - uses 30 decimal precision"
    };
    
    // Save updated deployment info
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    
    console.log("\n✅ Deployment info saved to:", deploymentPath);
    console.log("\n=== Oracle Deployment Complete ===");
    console.log("Address:", oracleAddress);
    console.log("\nKey points:");
    console.log("- Handles prices for all markets (NGN, ARS, PKR, GHS, COP)");
    console.log("- Uses 30 decimal precision (GMX V2 standard)");
    console.log("- Single signer configured in OracleStore");
    console.log("\nToken mappings for FX markets:");
    Object.entries(tokenMappings).forEach(([currency, address]) => {
        console.log(`  ${currency}: ${address}`);
    });
    console.log("\n⚠️  IMPORTANT: Your keeper needs to be updated to:");
    console.log("  1. Push to this new Oracle address");
    console.log("  2. Convert prices to 30 decimal precision (multiply by 10^22)");
    console.log("  3. Set both min and max prices (can be the same for FX)");
    console.log("\nNext steps:");
    console.log("1. Update keeper script for V2 Oracle");
    console.log("2. Deploy Order Executors");
    console.log("3. Deploy OrderHandler");
    
    return oracleAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });