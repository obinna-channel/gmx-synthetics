const fs = require("fs");
const path = require("path");

/**
 * Script to migrate your existing Marks deployments to the hardhat-deploy format
 * This will create the proper structure in deployments/marks/arbitrumSepolia/
 */

async function migrateDeployments() {
    console.log("=== Migrating Marks Exchange Deployments ===\n");
    
    // Load your existing deployment data
    const marksDeploymentPath = path.join(__dirname, "deployments/marks-exchange-deployment.json");
    
    if (!fs.existsSync(marksDeploymentPath)) {
        console.error("Could not find deployments/marks-exchange-deployment.json");
        console.log("Make sure you're running this from the project root");
        process.exit(1);
    }
    
    const marksData = JSON.parse(fs.readFileSync(marksDeploymentPath, 'utf8'));
    
    // Create the new deployment directory structure
    const newDeploymentDir = path.join(__dirname, "deployments/marks/arbitrumSepolia");
    
    if (!fs.existsSync(newDeploymentDir)) {
        fs.mkdirSync(newDeploymentDir, { recursive: true });
        console.log(`Created directory: ${newDeploymentDir}`);
    }
    
    // Create .chainId file (Arbitrum Sepolia chain ID)
    const chainId = "421614"; // Arbitrum Sepolia
    fs.writeFileSync(path.join(newDeploymentDir, ".chainId"), chainId);
    console.log(`Created .chainId file with: ${chainId}`);
    
    // Migrate each contract to hardhat-deploy format
    const contracts = marksData.contracts;
    let migratedCount = 0;
    
    for (const [contractName, contractData] of Object.entries(contracts)) {
        console.log(`\nMigrating ${contractName}...`);
        
        // Skip if no address (like Oracle might be under a different name)
        if (!contractData.address) {
            console.log(`  ⚠️  Skipping ${contractName} - no address found`);
            continue;
        }
        
        // Create deployment file in hardhat-deploy format
        const deploymentData = {
            address: contractData.address,
            abi: [], // We'll need to fill this from the artifacts
            transactionHash: contractData.transactionHash || "0x0", // Add if you have it
            receipt: {
                blockNumber: contractData.deploymentBlock || 0,
                blockHash: "0x0", // Add if you have it
                from: contractData.deployer || marksData.deployer || "0x0"
            },
            args: [], // Constructor arguments - we'll need to add these
            bytecode: "0x", // Add if needed
            deployedBytecode: "0x", // Add if needed
            metadata: JSON.stringify({
                compiler: { version: "0.8.18+commit.87f61d96" },
                language: "Solidity",
                output: { abi: [], devdoc: {}, userdoc: {} },
                settings: {},
                sources: {},
                version: 1
            }),
            devdoc: {},
            userdoc: {},
            storageLayout: null,
            notes: contractData.notes || ""
        };
        
        // Try to load ABI from artifacts
        try {
            const artifactPath = path.join(
                __dirname, 
                `artifacts/contracts`,
                findContractPath(contractName),
                `${contractName}.json`
            );
            
            if (fs.existsSync(artifactPath)) {
                const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
                deploymentData.abi = artifact.abi;
                deploymentData.bytecode = artifact.bytecode;
                deploymentData.deployedBytecode = artifact.deployedBytecode;
                console.log(`  ✅ Found ABI for ${contractName}`);
            } else {
                console.log(`  ⚠️  Could not find artifact for ${contractName}`);
                console.log(`     Expected at: ${artifactPath}`);
            }
        } catch (error) {
            console.log(`  ⚠️  Error loading artifact for ${contractName}:`, error.message);
        }
        
        // Write the deployment file
        const deploymentFilePath = path.join(newDeploymentDir, `${contractName}.json`);
        fs.writeFileSync(deploymentFilePath, JSON.stringify(deploymentData, null, 2));
        console.log(`  ✅ Created ${contractName}.json`);
        migratedCount++;
    }
    
    // Special handling for MarksSimplifiedOracle (might be stored as Oracle)
    if (contracts.MarksSimplifiedOracle || contracts.Oracle) {
        const oracleData = contracts.MarksSimplifiedOracle || contracts.Oracle;
        if (oracleData.address === "0x178a0F71bAB704b989A9930E109aBC11eE9beCe0") {
            // Create an Oracle.json file for compatibility
            const oracleDeployment = {
                address: oracleData.address,
                abi: [], // Will need to be filled
                notes: "MarksSimplifiedOracle deployed as Oracle"
            };
            fs.writeFileSync(
                path.join(newDeploymentDir, "Oracle.json"),
                JSON.stringify(oracleDeployment, null, 2)
            );
            console.log("\n✅ Created Oracle.json for MarksSimplifiedOracle");
        }
    }
    
    console.log("\n=== Migration Summary ===");
    console.log(`Migrated ${migratedCount} contracts to ${newDeploymentDir}`);
    console.log("\nNext steps:");
    console.log("1. Update hardhat.config.ts to use paths.deployments = 'deployments/marks'");
    console.log("2. You may need to manually add constructor arguments to the deployment files");
    console.log("3. You can now use TypeScript deployment scripts for remaining contracts");
    console.log("\nTo deploy Order Executors:");
    console.log("npx hardhat deploy --tags IncreaseOrderExecutor --network arbitrumSepolia");
}

// Helper function to find contract path in artifacts
function findContractPath(contractName) {
    const possiblePaths = [
        "role",
        "data", 
        "event",
        "router",
        "order",
        "oracle",
        "exchange",
        "market",
        "position"
    ];
    
    for (const dir of possiblePaths) {
        const fullPath = path.join(__dirname, "artifacts/contracts", dir, contractName + ".sol");
        if (fs.existsSync(fullPath)) {
            return path.join(dir, contractName + ".sol");
        }
    }
    
    // Default fallback
    return contractName + ".sol";
}

// Run the migration
migrateDeployments()
    .then(() => {
        console.log("\n✅ Migration completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Migration failed:", error);
        process.exit(1);
    });