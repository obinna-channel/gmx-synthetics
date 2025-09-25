const { ethers } = require("hardhat");

async function main() {
    console.log("=== GRANTING MARKET_KEEPER ROLE ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    // Get RoleStore
    const roleStore = await ethers.getContractAt("RoleStore", "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778");

    // Calculate MARKET_KEEPER role hash
    const MARKET_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_KEEPER"])
    );

    console.log("MARKET_KEEPER role hash:", MARKET_KEEPER);

    // Check if deployer already has the role
    const hasRole = await roleStore.hasRole(deployer.address, MARKET_KEEPER);
    console.log("Deployer has MARKET_KEEPER role:", hasRole);

    if (!hasRole) {
        console.log("\nGranting MARKET_KEEPER role to deployer...");
        const tx = await roleStore.grantRole(deployer.address, MARKET_KEEPER);
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("✓ Role granted successfully! Gas used:", receipt.gasUsed.toString());

        // Verify
        const hasRoleAfter = await roleStore.hasRole(deployer.address, MARKET_KEEPER);
        console.log("Verification - Deployer has MARKET_KEEPER role:", hasRoleAfter);
    } else {
        console.log("✓ Deployer already has MARKET_KEEPER role");
    }

    // Also check MarketFactory address
    const marketFactoryAddress = "0x6691AFCa903E83996493283ab827DE22E9018959";
    console.log("\n=== VERIFYING MARKET FACTORY ===");
    console.log("MarketFactory address:", marketFactoryAddress);

    // Check if MarketFactory has CONTROLLER role
    const CONTROLLER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );

    const marketFactoryHasController = await roleStore.hasRole(marketFactoryAddress, CONTROLLER);
    console.log("MarketFactory has CONTROLLER role:", marketFactoryHasController);

    if (!marketFactoryHasController) {
        console.log("⚠️ MarketFactory needs CONTROLLER role");
        console.log("Granting CONTROLLER role to MarketFactory...");
        const tx2 = await roleStore.grantRole(marketFactoryAddress, CONTROLLER);
        await tx2.wait();
        console.log("✓ CONTROLLER role granted to MarketFactory");
    }

    console.log("\n✅ All roles configured. You can now deploy markets.");
}

main().catch(console.error);