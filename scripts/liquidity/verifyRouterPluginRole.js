const { ethers } = require("hardhat");

async function main() {
    console.log("=== VERIFYING ROUTER_PLUGIN ROLE CHECK ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";

    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Check ROUTER_PLUGIN role
    const ROUTER_PLUGIN = ethers.utils.id("ROUTER_PLUGIN");
    console.log("ROUTER_PLUGIN role hash:", ROUTER_PLUGIN);
    console.log("Checking if ExchangeRouter has this role...\n");

    const hasPluginRole = await roleStore.hasRole(EXCHANGE_ROUTER, ROUTER_PLUGIN);

    console.log("Result from hasRole():", hasPluginRole);

    if (hasPluginRole) {
        console.log("✅ ExchangeRouter HAS the ROUTER_PLUGIN role");
    } else {
        console.log("❌ ExchangeRouter does NOT have the ROUTER_PLUGIN role");
    }

    // Let's also check what roles the ExchangeRouter DOES have
    console.log("\n=== CHECKING OTHER COMMON ROLES ===");

    const rolesToCheck = [
        "ROUTER_PLUGIN",
        "CONTROLLER",
        "ORDER_KEEPER",
        "MARKET_KEEPER",
        "FROZEN_ORDER_KEEPER",
        "PRICING_KEEPER",
        "LIQUIDATION_KEEPER",
        "ADL_KEEPER"
    ];

    let hasAnyRole = false;
    for (const roleName of rolesToCheck) {
        const roleHash = ethers.utils.id(roleName);
        const hasRole = await roleStore.hasRole(EXCHANGE_ROUTER, roleHash);
        if (hasRole) {
            console.log(`✅ Has ${roleName} role`);
            hasAnyRole = true;
        }
    }

    if (!hasAnyRole) {
        console.log("❌ ExchangeRouter has NO roles assigned");
    }

    // Check the role admin to see who can grant this role
    console.log("\n=== WHO CAN GRANT ROUTER_PLUGIN ROLE? ===");
    const roleAdmin = await roleStore.getRoleAdmin(ROUTER_PLUGIN);
    console.log("Role admin for ROUTER_PLUGIN:", roleAdmin);

    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    if (roleAdmin === DEFAULT_ADMIN_ROLE) {
        console.log("This is the DEFAULT_ADMIN_ROLE");

        // Check if we have admin role
        const [signer] = await ethers.getSigners();
        const hasAdminRole = await roleStore.hasRole(signer.address, DEFAULT_ADMIN_ROLE);
        console.log("\nDo we have admin role?", hasAdminRole);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });