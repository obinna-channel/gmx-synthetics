const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING AND GRANTING ROLES ===\n");

    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ROUTER = "0x200882043647295a21F9202f9C1535BfB2A2f127";
    
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    const [deployer] = await ethers.getSigners();
    
    // Important roles for deposits
    const roles = [
        { name: "CONTROLLER", value: ethers.utils.id("CONTROLLER") },
        { name: "ROUTER_PLUGIN", value: ethers.utils.id("ROUTER_PLUGIN") },
        { name: "MARKET_KEEPER", value: ethers.utils.id("MARKET_KEEPER") },
        { name: "ORDER_KEEPER", value: ethers.utils.id("ORDER_KEEPER") }
    ];
    
    const contracts = [
        { name: "ExchangeRouter", address: EXCHANGE_ROUTER },
        { name: "DepositHandler", address: DEPOSIT_HANDLER },
        { name: "Router", address: ROUTER }
    ];
    
    console.log("Checking which contracts have which roles:\n");
    
    for (const contract of contracts) {
        console.log(`${contract.name} (${contract.address}):`);
        for (const role of roles) {
            const hasRole = await roleStore.hasRole(contract.address, role.value);
            console.log(`  ${role.name}: ${hasRole ? "✓" : "✗"}`);
        }
    }
    
    // ExchangeRouter needs CONTROLLER role to create deposits
    console.log("\nGranting CONTROLLER role to ExchangeRouter...");
    try {
        const hasController = await roleStore.hasRole(EXCHANGE_ROUTER, ethers.utils.id("CONTROLLER"));
        if (!hasController) {
            const tx = await roleStore.grantRole(EXCHANGE_ROUTER, ethers.utils.id("CONTROLLER"));
            await tx.wait();
            console.log("✓ Granted CONTROLLER role to ExchangeRouter");
        } else {
            console.log("ExchangeRouter already has CONTROLLER role");
        }
    } catch (e) {
        console.log("Error granting role:", e.message);
    }
    
    // DepositHandler might need CONTROLLER role too
    console.log("\nGranting CONTROLLER role to DepositHandler...");
    try {
        const hasController = await roleStore.hasRole(DEPOSIT_HANDLER, ethers.utils.id("CONTROLLER"));
        if (!hasController) {
            const tx = await roleStore.grantRole(DEPOSIT_HANDLER, ethers.utils.id("CONTROLLER"));
            await tx.wait();
            console.log("✓ Granted CONTROLLER role to DepositHandler");
        } else {
            console.log("DepositHandler already has CONTROLLER role");
        }
    } catch (e) {
        console.log("Error granting role:", e.message);
    }
}

main().catch(console.error);
