const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING ROUTER_PLUGIN ROLE ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";

    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Calculate ROUTER_PLUGIN role hash
    const ROUTER_PLUGIN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ROUTER_PLUGIN"])
    );

    console.log("ROUTER_PLUGIN role hash:", ROUTER_PLUGIN);
    console.log("ExchangeRouter address:", EXCHANGE_ROUTER);

    // Check if ExchangeRouter has ROUTER_PLUGIN role
    const hasRole = await roleStore.hasRole(EXCHANGE_ROUTER, ROUTER_PLUGIN);
    console.log("\nExchangeRouter has ROUTER_PLUGIN role:", hasRole);

    if (!hasRole) {
        console.log("\n❌ ISSUE FOUND: ExchangeRouter doesn't have ROUTER_PLUGIN role!");
        console.log("This is why the token transfer is failing.");

        const [deployer] = await ethers.getSigners();
        console.log("\n=== FIXING THE ISSUE ===");
        console.log("Granting ROUTER_PLUGIN role to ExchangeRouter...");

        const tx = await roleStore.grantRole(EXCHANGE_ROUTER, ROUTER_PLUGIN);
        await tx.wait();
        console.log("✓ Role granted!");

        const hasRoleAfter = await roleStore.hasRole(EXCHANGE_ROUTER, ROUTER_PLUGIN);
        console.log("Verification - ExchangeRouter has ROUTER_PLUGIN role:", hasRoleAfter);
    } else {
        console.log("✓ ExchangeRouter already has ROUTER_PLUGIN role");
    }
}

main().catch(console.error);