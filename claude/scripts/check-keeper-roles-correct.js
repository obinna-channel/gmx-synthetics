const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Checking Keeper Roles (Correct Hashes) ===\n");
    console.log("Your address:", signer.address);

    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Let's check different possible role names
    const roleNames = [
        "KEEPER",
        "ORDER_KEEPER", 
        "MARKET_KEEPER",
        "FROZEN_ORDER_KEEPER",
        "PRICING_KEEPER",
        "LIQUIDATION_KEEPER",
        "ADL_KEEPER",
        "CONTROLLER",
        "ROLE_ADMIN"
    ];

    console.log("\nRole Checks:");
    console.log("Role Name                  | Has Role | Role Hash");
    console.log("---------------------------|----------|------------------------------------------");
    
    for (const roleName of roleNames) {
        const roleHash = ethers.utils.id(roleName);
        const hasRole = await roleStore.hasRole(signer.address, roleHash);
        console.log(
            roleName.padEnd(26) + " | " + 
            (hasRole ? "✅ YES  " : "❌ NO   ") + " | " + 
            roleHash
        );
    }

    // Also check what the DepositHandler expects
    console.log("\n📋 Note: DepositHandler.executeDeposit typically requires:");
    console.log("  - ORDER_KEEPER role (most common)");
    console.log("  - or CONTROLLER role");
    console.log("  - or specific keeper role configured in DataStore");
    
    // Check if there's a specific deposit keeper role in DataStore
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    try {
        // Try to check if there's a DEPOSIT_KEEPER role configured
        const DEPOSIT_KEEPER = ethers.utils.id("DEPOSIT_KEEPER");
        const hasDepositKeeper = await roleStore.hasRole(signer.address, DEPOSIT_KEEPER);
        if (hasDepositKeeper) {
            console.log("\n✅ You have DEPOSIT_KEEPER role!");
        }
    } catch (e) {
        // Ignore if not found
    }
}

main().catch(console.error);