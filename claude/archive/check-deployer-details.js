const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Current signer (deployer):", signer.address);
    
    // Get RoleStore deployment transaction
    const roleStoreDeployment = require("../deployments/marks/arbitrumSepolia/RoleStore.json");
    console.log("\nRoleStore Deployment:");
    console.log("=====================");
    console.log("Contract address:", roleStoreDeployment.address);
    console.log("Transaction hash:", roleStoreDeployment.transactionHash);
    
    // Get the transaction receipt to see who deployed it
    const tx = await ethers.provider.getTransaction(roleStoreDeployment.transactionHash);
    console.log("Deployed from address:", tx.from);
    
    // Check if the deployer has ROLE_ADMIN
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreDeployment.address);
    const ROLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
    
    const deployerHasRoleAdmin = await roleStore.hasRole(tx.from, ROLE_ADMIN);
    console.log("\nDoes deployer have ROLE_ADMIN?", deployerHasRoleAdmin ? "✅ YES" : "❌ NO");
    
    // Check if current signer has ROLE_ADMIN
    const signerHasRoleAdmin = await roleStore.hasRole(signer.address, ROLE_ADMIN);
    console.log("Does current signer have ROLE_ADMIN?", signerHasRoleAdmin ? "✅ YES" : "❌ NO");
    
    // They should be the same
    console.log("\n\nAre they the same address?", tx.from === signer.address ? "✅ YES" : "❌ NO");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
