const { ethers } = require("hardhat");

async function main() {
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    // ROLE_ADMIN role hash
    const ROLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
    console.log("ROLE_ADMIN hash:", ROLE_ADMIN);
    
    // Check who has ROLE_ADMIN
    const addresses = [
        ["0xBaB0D0892Bf8563B731f8e8970fE856ce9308292", "YOUR DEPLOYER"],
        ["0xCD9706B6B71fdC4351091B5b1D910cEe7Fde28D0", "Keeper 6"],
        ["0x508cbC56Ab57A9b0221cf1810a483f8013c92Ff3", "Keeper 7"],
    ];
    
    console.log("\nChecking who has ROLE_ADMIN:");
    console.log("================================");
    
    for (const [address, label] of addresses) {
        const hasRole = await roleStore.hasRole(address, ROLE_ADMIN);
        const status = hasRole ? "✅ HAS ROLE_ADMIN" : "❌ NO ROLE_ADMIN";
        console.log(`${address} (${label}): ${status}`);
    }
    
    // Also check the original deployer of RoleStore
    const deploymentData = require("../deployments/marks/arbitrumSepolia/RoleStore.json");
    console.log("\n\nRoleStore deployment info:");
    console.log("==========================");
    console.log("Contract deployed by transaction:", deploymentData.transactionHash);
    console.log("Contract address:", deploymentData.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
