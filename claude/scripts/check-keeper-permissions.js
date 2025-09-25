const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Checking Keeper Permissions ===\n");
    console.log("Your address:", signer.address);

    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Check various keeper roles
    const ORDER_KEEPER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORDER_KEEPER"));
    const CONTROLLER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
    const ROLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
    const CONFIG_KEEPER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONFIG_KEEPER"));

    console.log("\nRole Checks:");
    
    const hasOrderKeeper = await roleStore.hasRole(signer.address, ORDER_KEEPER);
    console.log("  ORDER_KEEPER:", hasOrderKeeper ? "✅ YES" : "❌ NO");
    
    const hasController = await roleStore.hasRole(signer.address, CONTROLLER);
    console.log("  CONTROLLER:", hasController ? "✅ YES" : "❌ NO");
    
    const hasRoleAdmin = await roleStore.hasRole(signer.address, ROLE_ADMIN);
    console.log("  ROLE_ADMIN:", hasRoleAdmin ? "✅ YES" : "❌ NO");
    
    const hasConfigKeeper = await roleStore.hasRole(signer.address, CONFIG_KEEPER);
    console.log("  CONFIG_KEEPER:", hasConfigKeeper ? "✅ YES" : "❌ NO");

    // Check DepositHandler
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    console.log("\nDepositHandler:", DEPOSIT_HANDLER);
    
    const hasDepositHandlerController = await roleStore.hasRole(DEPOSIT_HANDLER, CONTROLLER);
    console.log("  Has CONTROLLER role:", hasDepositHandlerController ? "✅ YES" : "❌ NO");

    // Check Oracle configuration
    const ORACLE_STORE = "0xD873432021Cb5e39248Cb64F8f3F11FBCE973222";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check MIN_ORACLE_SIGNERS
    const MIN_ORACLE_SIGNERS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );
    const minOracleSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS_KEY);
    console.log("\nOracle Configuration:");
    console.log("  MIN_ORACLE_SIGNERS:", minOracleSigners.toString());

    // Provide execution guidance
    console.log("\n📋 Execution Requirements:");
    if (hasOrderKeeper) {
        console.log("  ✅ You have ORDER_KEEPER role - can execute deposits!");
    } else if (hasController) {
        console.log("  ✅ You have CONTROLLER role - can grant ORDER_KEEPER to yourself!");
    } else if (hasRoleAdmin) {
        console.log("  ✅ You have ROLE_ADMIN - can grant any role!");
    } else {
        console.log("  ⚠️  You don't have keeper permissions.");
        console.log("  Options:");
        console.log("    1. Get ORDER_KEEPER role granted by an admin");
        console.log("    2. Wait for an automated keeper to execute");
    }

    if (minOracleSigners.eq(0)) {
        console.log("\n  ✅ MIN_ORACLE_SIGNERS is 0 - oracle validation might be bypassed!");
    } else {
        console.log("\n  ⚠️  MIN_ORACLE_SIGNERS is", minOracleSigners.toString(), "- need valid oracle prices");
    }
}

main().catch(console.error);