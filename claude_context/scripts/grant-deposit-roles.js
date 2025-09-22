const { ethers } = require("hardhat");

async function main() {
    console.log("=== GRANTING DEPOSIT ROLES ===\n");

    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    const CONTROLLER = ethers.utils.id("CONTROLLER");
    
    // Check ExchangeRouter
    const exchangeRouterHasRole = await roleStore.hasRole(EXCHANGE_ROUTER, CONTROLLER);
    console.log("ExchangeRouter has CONTROLLER:", exchangeRouterHasRole);
    
    if (!exchangeRouterHasRole) {
        console.log("Granting CONTROLLER to ExchangeRouter...");
        const tx1 = await roleStore.grantRole(EXCHANGE_ROUTER, CONTROLLER);
        await tx1.wait();
        console.log("✓ Granted");
    }
    
    // Check DepositHandler
    const depositHandlerHasRole = await roleStore.hasRole(DEPOSIT_HANDLER, CONTROLLER);
    console.log("DepositHandler has CONTROLLER:", depositHandlerHasRole);
    
    if (!depositHandlerHasRole) {
        console.log("Granting CONTROLLER to DepositHandler...");
        const tx2 = await roleStore.grantRole(DEPOSIT_HANDLER, CONTROLLER);
        await tx2.wait();
        console.log("✓ Granted");
    }
    
    console.log("\n✅ Roles granted! Now deposits should work.");
}

main().catch(console.error);
