const { ethers } = require("hardhat");

async function main() {
    console.log("=== TRANSFERRING MOCK ORACLE PROVIDER OWNERSHIP ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    const MOCK_ORACLE_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const NEW_KEEPER_ADDRESS = "0xB9438AeD3ff32E30737268ae0f835217E79a76F5";

    console.log("MockOracleProvider:", MOCK_ORACLE_PROVIDER);
    console.log("New keeper (new owner):", NEW_KEEPER_ADDRESS);

    // Get MockOracleProvider contract
    const mockOracle = await ethers.getContractAt(
        "MockOracleProvider",
        MOCK_ORACLE_PROVIDER
    );

    // Check current owner
    const currentOwner = await mockOracle.owner();
    console.log("\nCurrent owner:", currentOwner);

    if (currentOwner.toLowerCase() === NEW_KEEPER_ADDRESS.toLowerCase()) {
        console.log("✅ New keeper is already the owner!");
        return;
    }

    if (currentOwner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error("❌ ERROR: You are not the current owner. Cannot transfer ownership.");
        console.error("   Current owner:", currentOwner);
        console.error("   Your address:", deployer.address);
        process.exit(1);
    }

    console.log("\n📝 Transferring ownership to new keeper...");

    // Transfer ownership
    const tx = await mockOracle.transferOwnership(NEW_KEEPER_ADDRESS);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Ownership transferred! Gas used:", receipt.gasUsed.toString());

    // Verify
    const newOwner = await mockOracle.owner();
    console.log("\n🔍 Verifying...");
    console.log("New owner:", newOwner);

    if (newOwner.toLowerCase() === NEW_KEEPER_ADDRESS.toLowerCase()) {
        console.log("\n✅ SUCCESS! New keeper can now update MockOracleProvider prices!");
    } else {
        console.log("\n⚠️ WARNING: Ownership transfer may have failed");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
