const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING KEEPER PERMISSIONS ===\n");

    const ORACLE_ADDRESS = "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C";
    const KEEPER_ADDRESS = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    const SNGN_TOKEN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const oracle = await ethers.getContractAt("Oracle", ORACLE_ADDRESS);

    // Check current price first
    console.log("Current Oracle State:");
    try {
        const currentPrice = await oracle.getPrimaryPrice(SNGN_TOKEN);
        console.log(`  sNGN price: ${ethers.utils.formatUnits(currentPrice.min, 30)} NGN per USDT`);
    } catch (e) {
        console.log("  sNGN: No price set");
    }

    // Check if keeper is authorized
    console.log("\nChecking keeper authorization:");

    // Get the RoleStore address from Oracle
    const roleStore = await oracle.roleStore();
    console.log("RoleStore address:", roleStore);

    const roleStoreContract = await ethers.getContractAt("RoleStore", roleStore);

    // Check if keeper has CONTROLLER role
    const CONTROLLER_ROLE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );

    const hasController = await roleStoreContract.hasRole(KEEPER_ADDRESS, CONTROLLER_ROLE);
    console.log(`Keeper has CONTROLLER role: ${hasController}`);

    // Try to simulate what the keeper does
    console.log("\n=== SIMULATING KEEPER PRICE UPDATE ===");

    const testPrice = 1505.2;
    const price30Decimals = ethers.utils.parseUnits(testPrice.toString(), 30);

    console.log(`Test price: ${testPrice} NGN per USDT`);
    console.log(`Price (30 decimals): ${price30Decimals.toString()}`);

    // Try to estimate gas for the update (this is where the keeper fails)
    try {
        console.log("\nEstimating gas for price update...");
        const gas = await oracle.estimateGas.setPrimaryPrice(
            SNGN_TOKEN,
            {min: price30Decimals, max: price30Decimals},
            {from: KEEPER_ADDRESS}  // Simulate from keeper address
        );
        console.log(`✓ Gas estimate successful: ${gas.toString()}`);
    } catch (e) {
        console.log(`✗ Gas estimate failed: ${e.reason || e.message}`);
        if (e.error && e.error.data) {
            console.log(`  Error data: ${e.error.data}`);
        }
    }

    // Try with deployer to see if it works
    const [deployer] = await ethers.getSigners();
    console.log("\n=== TESTING WITH DEPLOYER ===");
    console.log("Deployer address:", deployer.address);

    const hasDeployerController = await roleStoreContract.hasRole(deployer.address, CONTROLLER_ROLE);
    console.log(`Deployer has CONTROLLER role: ${hasDeployerController}`);

    try {
        console.log("\nEstimating gas with deployer...");
        const gas = await oracle.estimateGas.setPrimaryPrice(
            SNGN_TOKEN,
            {min: price30Decimals, max: price30Decimals}
        );
        console.log(`✓ Gas estimate successful: ${gas.toString()}`);

        // Actually try to update
        console.log("\nUpdating price with deployer...");
        const tx = await oracle.setPrimaryPrice(SNGN_TOKEN, {min: price30Decimals, max: price30Decimals});
        const receipt = await tx.wait();
        console.log(`✓ Price updated successfully! Gas used: ${receipt.gasUsed}`);
    } catch (e) {
        console.log(`✗ Failed: ${e.reason || e.message}`);
    }

    // Final recommendation
    console.log("\n=== DIAGNOSIS ===");
    if (!hasController) {
        console.log("❌ ISSUE FOUND: Keeper does not have CONTROLLER role!");
        console.log("\nFIX: Grant CONTROLLER role to keeper address:");
        console.log(`  await roleStoreContract.grantRole("${KEEPER_ADDRESS}", "${CONTROLLER_ROLE}")`);
    } else {
        console.log("✓ Keeper has correct permissions");
        console.log("Check if there are other restrictions in the Oracle contract");
    }
}

main().catch(console.error);