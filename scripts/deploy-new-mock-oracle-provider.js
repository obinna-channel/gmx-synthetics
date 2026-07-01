const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEPLOYING NEW MOCK ORACLE PROVIDER ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Deploy MockOracleProvider
    const MockOracleProvider = await ethers.getContractFactory(
        "contracts/oracle/MockOracleProvider.sol:MockOracleProvider"
    );

    console.log("\nDeploying MockOracleProvider...");
    const mockProvider = await MockOracleProvider.deploy();
    await mockProvider.deployed();

    console.log("\n✅ MockOracleProvider deployed to:", mockProvider.address);
    console.log("   Owner:", await mockProvider.owner());

    // Save address to file
    const fs = require('fs');
    const addressFile = './keeper/new_mock_provider_address.txt';
    fs.writeFileSync(addressFile, mockProvider.address);
    console.log("\n💾 Address saved to:", addressFile);

    console.log("\n📝 Next steps:");
    console.log("1. Verify on Arbiscan");
    console.log("2. Update DataStore configuration");
    console.log("3. Authorize keeper wallets");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
