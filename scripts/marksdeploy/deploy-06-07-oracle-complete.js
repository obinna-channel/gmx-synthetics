const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting Oracle system deployment (OracleStore + Oracle)...");
    console.log("This deploys both contracts and configures them properly\n");
    
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
    
    // STEP 1: Deploy OracleStore (without configuration)
    console.log("\n1. Deploying OracleStore...");
    const OracleStore = await ethers.getContractFactory("OracleStore");
    const oracleStore = await OracleStore.deploy(roleStoreAddress, eventEmitterAddress);
    
    if (oracleStore.deployed) {
        await oracleStore.deployed();
    } else if (oracleStore.waitForDeployment) {
        await oracleStore.waitForDeployment();
    }
    
    const oracleStoreAddress = oracleStore.address || (await oracleStore.getAddress());
    console.log("✅ OracleStore deployed to:", oracleStoreAddress);
    
    // STEP 2: Deploy Oracle
    console.log("\n2. Deploying Oracle...");
    const Oracle = await ethers.getContractFactory("Oracle");
    const dataStoreAddress = deploymentData.contracts.DataStore.address;
    
    // For Arbitrum, we need the sequencer uptime feed address
    // On testnet, we can use zero address or a mock
    const sequencerUptimeFeed = "0x0000000000000000000000000000000000000000";
    
    console.log("Using DataStore at:", dataStoreAddress);
    console.log("Using sequencerUptimeFeed:", sequencerUptimeFeed);
    
    const oracle = await Oracle.deploy(
        roleStoreAddress,
        dataStoreAddress,  // Note: DataStore, not OracleStore!
        eventEmitterAddress,
        sequencerUptimeFeed
    );
    
    if (oracle.deployed) {
        await oracle.deployed();
    } else if (oracle.waitForDeployment) {
        await oracle.waitForDeployment();
    }
    
    const oracleAddress = oracle.address || (await oracle.getAddress());
    console.log("✅ Oracle deployed to:", oracleAddress);
    
    // STEP 3: Grant CONTROLLER role to Oracle
    console.log("\n3. Setting up permissions...");
    const RoleStore = await ethers.getContractFactory("RoleStore");
    const roleStore = RoleStore.attach(roleStoreAddress);
    
    const CONTROLLER_ROLE = ethers.utils ? ethers.utils.id("CONTROLLER") : ethers.id("CONTROLLER");
    
    // Grant CONTROLLER to Oracle
    let tx = await roleStore.grantRole(oracleAddress, CONTROLLER_ROLE);
    await tx.wait();
    console.log("✅ Granted CONTROLLER role to Oracle");
    
    // Also grant CONTROLLER to OracleStore (so it can be managed)
    tx = await roleStore.grantRole(oracleStoreAddress, CONTROLLER_ROLE);
    await tx.wait();
    console.log("✅ Granted CONTROLLER role to OracleStore");
    
    // Grant CONTROLLER to deployer for configuration
    tx = await roleStore.grantRole(deployerAddress, CONTROLLER_ROLE);
    await tx.wait();
    console.log("✅ Granted CONTROLLER role to deployer");
    
    // STEP 4: Configure OracleStore with signer
    console.log("\n4. Configuring OracleStore with single signer...");
    
    // Now try to add signer with proper permissions
    try {
        const addSignerTx = await oracleStore.addSigner(deployerAddress);
        await addSignerTx.wait();
        console.log("✅ Added deployer as oracle signer:", deployerAddress);
    } catch (error) {
        console.log("⚠️  Could not add signer automatically. You may need to do this manually.");
        console.log("   Error:", error.message);
    }
    
    // Update deployment info
    const blockNumber = await ethers.provider.getBlockNumber();
    
    // Define token mappings
    const tokenMappings = {
        NGN: "0x0000000000000000000000000000000000000001",
        ARS: "0x0000000000000000000000000000000000000002", 
        PKR: "0x0000000000000000000000000000000000000003",
        GHS: "0x0000000000000000000000000000000000000004",
        COP: "0x0000000000000000000000000000000000000008"
    };
    
    deploymentData.contracts.OracleStore = {
        address: oracleStoreAddress,
        deployer: deployerAddress,
        deploymentBlock: blockNumber,
        roleStoreAddress: roleStoreAddress,
        eventEmitterAddress: eventEmitterAddress,
        notes: "Oracle configuration store"
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
    console.log("\n=== Oracle System Deployment Complete ===");
    console.log("OracleStore:", oracleStoreAddress);
    console.log("Oracle:", oracleAddress);
    console.log("\nToken mappings for FX markets:");
    Object.entries(tokenMappings).forEach(([currency, address]) => {
        console.log(`  ${currency}: ${address}`);
    });
    
    console.log("\n⚠️  IMPORTANT NOTES:");
    console.log("1. If signer wasn't added automatically, manually call addSigner");
    console.log("2. Update your keeper to push prices to:", oracleAddress);
    console.log("3. Use 30 decimal precision (multiply by 10^22)");
    console.log("\nNext steps:");
    console.log("1. Deploy Order Executors");
    console.log("2. Deploy OrderHandler");
    
    return { oracleStore: oracleStoreAddress, oracle: oracleAddress };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });