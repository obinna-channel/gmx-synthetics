const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    const addresses = {
        RoleStore: "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778",
        DataStore: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        OracleStore: "0x3515052c8ba177610628E79a83C15F889F2627c2",
        Oracle: "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C"
    };

    console.log("=== ORACLE DEPLOYMENT STATUS CHECK ===\n");
    console.log("Deployer:", deployer.address);
    console.log("\nContract Addresses:");
    Object.entries(addresses).forEach(([name, addr]) => {
        console.log(`  ${name}: ${addr}`);
    });

    const roleStore = await ethers.getContractAt("RoleStore", addresses.RoleStore);
    const CONTROLLER = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"]));

    // Check CONTROLLER roles
    console.log("\n=== CONTROLLER ROLE STATUS ===");
    const deployerHasController = await roleStore.hasRole(deployer.address, CONTROLLER);
    const oracleHasController = await roleStore.hasRole(addresses.Oracle, CONTROLLER);
    const oracleStoreHasController = await roleStore.hasRole(addresses.OracleStore, CONTROLLER);

    console.log(`  Deployer: ${deployerHasController ? "✓ HAS CONTROLLER" : "✗ NO CONTROLLER"}`);
    console.log(`  Oracle: ${oracleHasController ? "✓ HAS CONTROLLER" : "✗ NO CONTROLLER"}`);
    console.log(`  OracleStore: ${oracleStoreHasController ? "✓ HAS CONTROLLER" : "✗ NO CONTROLLER"}`);

    // Check DataStore parameters
    console.log("\n=== ORACLE CONFIGURATION PARAMETERS ===");
    const dataStore = await ethers.getContractAt("DataStore", addresses.DataStore);

    const hashString = (str) => ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], [str])
    );

    const params = {
        MIN_ORACLE_SIGNERS: await dataStore.getUint(hashString("MIN_ORACLE_SIGNERS")),
        MIN_ORACLE_BLOCK_CONFIRMATIONS: await dataStore.getUint(hashString("MIN_ORACLE_BLOCK_CONFIRMATIONS")),
        MAX_ORACLE_PRICE_AGE: await dataStore.getUint(hashString("MAX_ORACLE_PRICE_AGE")),
        MAX_ORACLE_TIMESTAMP_RANGE: await dataStore.getUint(hashString("MAX_ORACLE_TIMESTAMP_RANGE")),
        MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR: await dataStore.getUint(hashString("MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR"))
    };

    Object.entries(params).forEach(([name, value]) => {
        console.log(`  ${name}: ${value.toString()}`);
    });

    // Check OracleStore signers
    console.log("\n=== ORACLE SIGNERS ===");
    const oracleStore = await ethers.getContractAt("OracleStore", addresses.OracleStore);
    const isDeployerSigner = await oracleStore.isSigner(deployer.address);
    console.log(`  Deployer (${deployer.address}) is signer: ${isDeployerSigner ? "✓ YES" : "✗ NO"}`);

    // Try to get signer count
    try {
        const signerCount = await oracleStore.getSignerCount();
        console.log(`  Total signers: ${signerCount.toString()}`);

        if (signerCount.gt(0)) {
            console.log("\n  Current signers:");
            for (let i = 0; i < Math.min(5, signerCount.toNumber()); i++) {
                try {
                    const signer = await oracleStore.getSigner(i);
                    console.log(`    [${i}]: ${signer}`);
                } catch (e) {
                    // Method might not exist
                }
            }
        }
    } catch (e) {
        // Try alternative method
        try {
            const signers = await oracleStore.getSigners(0, 10);
            if (signers && signers.length > 0) {
                console.log(`  Total signers found: ${signers.length}`);
                console.log("\n  Current signers:");
                signers.forEach((s, i) => console.log(`    [${i}]: ${s}`));
            }
        } catch (e2) {
            console.log("  (Cannot enumerate signers - no getter function available)");
        }
    }

    // Check Oracle dependencies
    console.log("\n=== ORACLE CONTRACT CONFIGURATION ===");
    const oracle = await ethers.getContractAt("Oracle", addresses.Oracle);

    try {
        const oracleRoleStore = await oracle.roleStore();
        console.log(`  Oracle's RoleStore: ${oracleRoleStore === addresses.RoleStore ? "✓ CORRECT" : "✗ WRONG"} (${oracleRoleStore})`);
    } catch (e) {
        console.log("  Oracle's RoleStore: Cannot read");
    }

    try {
        const oracleOracleStore = await oracle.oracleStore();
        console.log(`  Oracle's OracleStore: ${oracleOracleStore === addresses.OracleStore ? "✓ CORRECT" : "✗ WRONG"} (${oracleOracleStore})`);
    } catch (e) {
        console.log("  Oracle's OracleStore: Cannot read");
    }

    // Analysis and recommendations
    console.log("\n=== ANALYSIS ===");

    const issues = [];
    const warnings = [];
    const success = [];

    // Check critical items
    if (deployerHasController) {
        success.push("Deployer has CONTROLLER role");
    } else {
        issues.push("Deployer missing CONTROLLER role");
    }

    if (oracleHasController) {
        success.push("Oracle contract has CONTROLLER role");
    } else {
        issues.push("Oracle contract missing CONTROLLER role");
    }

    if (oracleStoreHasController) {
        success.push("OracleStore contract has CONTROLLER role");
    } else {
        issues.push("OracleStore contract missing CONTROLLER role");
    }

    const minSigners = params.MIN_ORACLE_SIGNERS;
    if (minSigners.toString() === "0") {
        issues.push("MIN_ORACLE_SIGNERS not set (is 0)");
    } else if (minSigners.toString() === "1") {
        success.push("MIN_ORACLE_SIGNERS correctly set to 1 for single keeper");
    } else {
        warnings.push(`MIN_ORACLE_SIGNERS is ${minSigners} (expected 1 for single keeper)`);
    }

    if (!isDeployerSigner) {
        warnings.push("Deployer is not configured as an oracle signer");
    } else {
        success.push("Deployer is configured as an oracle signer");
    }

    console.log("\n✓ SUCCESS:");
    success.forEach(item => console.log(`  - ${item}`));

    if (warnings.length > 0) {
        console.log("\n⚠ WARNINGS:");
        warnings.forEach(item => console.log(`  - ${item}`));
    }

    if (issues.length > 0) {
        console.log("\n✗ ISSUES:");
        issues.forEach(item => console.log(`  - ${item}`));
    }

    console.log("\n=== NEXT STEPS ===");
    if (!isDeployerSigner && minSigners.toString() === "1") {
        console.log("1. Add deployer as oracle signer: oracleStore.addSigner(deployer.address)");
    }
    if (minSigners.toString() !== "1") {
        console.log("1. Set MIN_ORACLE_SIGNERS to 1 for single keeper operation");
    }
    console.log("2. Grant ORACLE_KEEPER role to your keeper address (if different from deployer)");
    console.log("3. Update your keeper script to format prices for GMX Oracle.setPrices()");
    console.log("4. Deploy remaining contracts (OrderHandler, ExchangeRouter, etc.)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });