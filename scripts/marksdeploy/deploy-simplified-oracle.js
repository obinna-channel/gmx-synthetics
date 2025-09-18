const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Deploying MarksSimplifiedOracle...\n");
    
    // Load existing deployment data
    const deploymentFile = path.join(__dirname, "../../deployments/marks-exchange-deployment.json");
    let deployments = {};
    
    if (fs.existsSync(deploymentFile)) {
        deployments = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
        console.log("Loaded existing deployment data");
    }
    
    // Get deployed addresses
    const roleStoreAddress = deployments.RoleStore || "0x81FBD321168655914C895ec63583140aB3eB2341";
    const dataStoreAddress = deployments.DataStore || "0xE0bf5B90c1d6B1381Ca28BBdb849641C18bcFdf5";
    const eventEmitterAddress = deployments.EventEmitter || "0x721572D44714B8DdcA1C4F54A4Ea67335d4EFB96";
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Deploy MarksSimplifiedOracle
    console.log("\n1. Deploying MarksSimplifiedOracle...");
    const Oracle = await ethers.getContractFactory("MarksSimplifiedOracle");
    const oracle = await Oracle.deploy(
        roleStoreAddress,
        dataStoreAddress,
        eventEmitterAddress
    );
    
    await oracle.deployed();
    console.log("✅ MarksSimplifiedOracle deployed to:", oracle.address);
    
    // Grant CONTROLLER role to the Oracle
    console.log("\n2. Granting CONTROLLER role to Oracle...");
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);
    
    // Correct CONTROLLER role hash from GMX
    const CONTROLLER_ROLE = "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b";
    
    // Grant role to Oracle
    let tx = await roleStore.grantRole(oracle.address, CONTROLLER_ROLE);
    await tx.wait();
    console.log("✅ CONTROLLER role granted to Oracle");
    
    // Grant role to deployer (for testing)
    const deployerHasRole = await roleStore.hasRole(deployer.address, CONTROLLER_ROLE);
    if (!deployerHasRole) {
        tx = await roleStore.grantRole(deployer.address, CONTROLLER_ROLE);
        await tx.wait();
        console.log("✅ CONTROLLER role granted to deployer");
    }
    
    // Save deployment info
    deployments.MarksSimplifiedOracle = oracle.address;
    deployments.Oracle = oracle.address; // Also save as main Oracle
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deployments, null, 2));
    console.log("\n✅ Deployment info saved");
    
    console.log("\n=== MarksSimplifiedOracle Deployment Complete ===");
    console.log("Oracle Address:", oracle.address);
    console.log("\nNext steps:");
    console.log("1. Update your keeper to use the new Oracle address");
    console.log("2. The keeper can now send prices directly without compression");
    console.log("3. Test with a simple price update");
    
    // Test the oracle with a simple price update
    console.log("\n=== Testing Oracle ===");
    try {
        const ngnToken = "0x0000000000000000000000000000000000000001";
        const price = ethers.utils.parseUnits("1500", 30); // 1500 with 30 decimals
        
        const params = {
            signerInfo: 0, // Not used in simplified version
            tokens: [ngnToken],
            compactedMinOracleBlockNumbers: [], // Not used
            compactedMaxOracleBlockNumbers: [], // Not used
            compactedOracleTimestamps: [], // Not used
            compactedDecimals: [], // Not used
            compactedMinPrices: [price], // Direct price, not compacted
            compactedMinPricesIndexes: [], // Not used
            compactedMaxPrices: [price], // Direct price, not compacted
            compactedMaxPricesIndexes: [], // Not used
            signatures: [], // Not used
            priceFeedTokens: [],
            realtimeFeedTokens: [],
            realtimeFeedData: []
        };
        
        console.log("Setting test price for NGN...");
        tx = await oracle.setPrices(params);
        await tx.wait();
        console.log("✅ Test price set successfully!");
        
        // Verify the price
        const priceResult = await oracle.getPrimaryPrice(ngnToken);
        console.log("NGN price verified:");
        console.log("  Min:", ethers.utils.formatUnits(priceResult.min, 30));
        console.log("  Max:", ethers.utils.formatUnits(priceResult.max, 30));
        
    } catch (error) {
        console.log("⚠️  Test price update failed:", error.message);
        console.log("You may need to manually test the oracle");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });