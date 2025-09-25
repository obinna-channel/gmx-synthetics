const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("=== ORACLE SYSTEM DEPLOYMENT CHECK ===\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    // Read deployment files
    const deploymentsPath = "./deployments/marks/arbitrumSepolia";
    
    // Get addresses from deployment files
    const getAddress = (contractName) => {
        try {
            const deployment = JSON.parse(
                fs.readFileSync(path.join(deploymentsPath, `${contractName}.json`), "utf8")
            );
            return deployment.address;
        } catch (e) {
            return null;
        }
    };
    
    const addresses = {
        RoleStore: getAddress("RoleStore"),
        DataStore: getAddress("DataStore"),
        EventEmitter: getAddress("EventEmitter"),
        OracleStore: getAddress("OracleStore"),
        Oracle: getAddress("Oracle"),
    };
    
    console.log("\nContract Addresses:");
    for (const [name, addr] of Object.entries(addresses)) {
        if (addr) {
            console.log(`  ${name}: ${addr}`);
        } else {
            console.log(`  ${name}: NOT FOUND`);
        }
    }
    
    // Check deployment status
    console.log("\n=== DEPLOYMENT STATUS ===");
    for (const [name, address] of Object.entries(addresses)) {
        if (address) {
            const code = await ethers.provider.getCode(address);
            const isDeployed = code.length > 2;
            console.log(`${name}: ${isDeployed ? "✓ Deployed" : "✗ Not deployed"}`);
        }
    }
    
    // Check roles
    console.log("\n=== CONTROLLER ROLE CHECK ===");
    const roleStore = await ethers.getContractAt("RoleStore", addresses.RoleStore);
    const CONTROLLER_ROLE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    
    const entities = [
        ["Deployer", deployer.address],
        ["OracleStore", addresses.OracleStore],
        ["Oracle", addresses.Oracle],
    ];
    
    for (const [name, address] of entities) {
        if (address) {
            const hasRole = await roleStore.hasRole(address, CONTROLLER_ROLE);
            console.log(`${name}: ${hasRole ? "✓ HAS CONTROLLER" : "✗ NO CONTROLLER"}`);
        }
    }
    
    // Check Oracle configuration
    console.log("\n=== ORACLE PARAMETERS IN DATASTORE ===");
    const dataStore = await ethers.getContractAt("DataStore", addresses.DataStore);
    
    // Helper to create keys
    const hashString = (str) => ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], [str])
    );
    
    const params = [
        ["MIN_ORACLE_SIGNERS", hashString("MIN_ORACLE_SIGNERS")],
        ["MIN_ORACLE_BLOCK_CONFIRMATIONS", hashString("MIN_ORACLE_BLOCK_CONFIRMATIONS")],
        ["MAX_ORACLE_PRICE_AGE", hashString("MAX_ORACLE_PRICE_AGE")],
        ["MAX_ORACLE_TIMESTAMP_RANGE", hashString("MAX_ORACLE_TIMESTAMP_RANGE")],
    ];
    
    for (const [name, key] of params) {
        const value = await dataStore.getUint(key);
        console.log(`  ${name}: ${value.toString()}`);
    }
    
    // Check OracleStore signers
    if (addresses.OracleStore) {
        console.log("\n=== ORACLE SIGNERS ===");
        const oracleStore = await ethers.getContractAt("OracleStore", addresses.OracleStore);
        
        const isDeployerSigner = await oracleStore.isSigner(deployer.address);
        console.log(`Deployer is signer: ${isDeployerSigner ? "✓ YES" : "✗ NO"}`);
        
        try {
            const signerCount = await oracleStore.getSignerCount();
            console.log(`Total signers: ${signerCount.toString()}`);
            
            // Get signers if possible
            if (signerCount.gt(0)) {
                console.log("Signers:");
                for (let i = 0; i < Math.min(5, signerCount.toNumber()); i++) {
                    const signer = await oracleStore.getSigner(i);
                    console.log(`  [${i}]: ${signer}`);
                }
            }
        } catch (e) {
            // Try alternative methods
            try {
                const signers = await oracleStore.getSigners(0, 10);
                console.log(`Signers found: ${signers.length}`);
                signers.forEach((s, i) => console.log(`  [${i}]: ${s}`));
            } catch (e2) {
                console.log("  (Cannot enumerate signers - no getter function)");
            }
        }
    }
    
    console.log("\n=== ANALYSIS ===");
    
    // Check for issues
    const issues = [];
    
    if (!addresses.OracleStore) issues.push("OracleStore not deployed");
    if (!addresses.Oracle) issues.push("Oracle not deployed");
    
    const deployerHasController = await roleStore.hasRole(deployer.address, CONTROLLER_ROLE);
    if (!deployerHasController) issues.push("Deployer missing CONTROLLER role");
    
    if (addresses.Oracle) {
        const oracleHasController = await roleStore.hasRole(addresses.Oracle, CONTROLLER_ROLE);
        if (!oracleHasController) issues.push("Oracle contract missing CONTROLLER role");
    }
    
    if (addresses.OracleStore) {
        const oracleStoreHasController = await roleStore.hasRole(addresses.OracleStore, CONTROLLER_ROLE);
        if (!oracleStoreHasController) issues.push("OracleStore contract missing CONTROLLER role");
    }
    
    const minSigners = await dataStore.getUint(hashString("MIN_ORACLE_SIGNERS"));
    if (minSigners.toString() === "0") issues.push("MIN_ORACLE_SIGNERS not set (is 0)");
    if (minSigners.toString() !== "1") issues.push(`MIN_ORACLE_SIGNERS is ${minSigners} (should be 1 for single keeper)`);
    
    if (issues.length > 0) {
        console.log("Issues found:");
        issues.forEach(issue => console.log(`  ✗ ${issue}`));
    } else {
        console.log("✓ No critical issues found!");
    }
    
    console.log("\n=== RECOMMENDATIONS ===");
    console.log("1. If MIN_ORACLE_SIGNERS is not 1, set it for single keeper operation");
    console.log("2. If deployer is not a signer, add it to OracleStore");
    console.log("3. Grant ORACLE_KEEPER role to your keeper address");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
