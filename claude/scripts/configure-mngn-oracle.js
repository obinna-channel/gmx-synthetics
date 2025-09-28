const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("Configuring MockOracleProvider for mNGN markets...\n");

    // Contract addresses
    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Get contract instances
    const dataStore = await ethers.getContractAt("DataStore", DATASTORE);
    const mockProvider = await ethers.getContractAt("contracts/oracle/MockOracleProvider.sol:MockOracleProvider", MOCK_PROVIDER);

    // Step 1: Set prices with exchange rate logic
    // USDT: 1 USDT = 1500 NGN, so price is 1500 * 10^(30-6) = 1500 * 10^24
    const usdtPrice = ethers.BigNumber.from("1500").mul(ethers.BigNumber.from("10").pow(24));

    // mNGN: 1 mNGN = 1 NGN, so price is 1 * 10^(30-18) = 10^12
    const mNGNPrice = ethers.BigNumber.from("10").pow(12);

    console.log("Setting exchange rate prices:");
    console.log("- USDT price: 1500 (1 USDT = 1500 NGN)");
    console.log("  Raw value:", usdtPrice.toString());
    console.log("- mNGN price: 1 (1 mNGN = 1 NGN)");
    console.log("  Raw value:", mNGNPrice.toString());

    // Set USDT price
    let tx = await mockProvider.setPriceWithPrecision(USDT, usdtPrice);
    await tx.wait();
    console.log("✅ USDT price set to 1500\n");

    // Set mNGN price
    tx = await mockProvider.setPriceWithPrecision(mNGN, mNGNPrice);
    await tx.wait();
    console.log("✅ mNGN price set to 1\n");

    // Step 2: Configure oracle provider for mNGN token
    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );

    // Set provider for mNGN
    const mNGNProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mNGN]
        )
    );

    console.log("Setting oracle provider mapping for mNGN...");
    tx = await dataStore.setAddress(mNGNProviderKey, MOCK_PROVIDER);
    await tx.wait();
    console.log("✅ Oracle provider mapping set for mNGN\n");

    // Verify the configuration
    const storedProvider = await dataStore.getAddress(mNGNProviderKey);
    console.log("Verification:");
    console.log("- mNGN token:", mNGN);
    console.log("- Configured provider:", storedProvider);
    console.log("- Expected provider:", MOCK_PROVIDER);
    console.log("- Match:", storedProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅" : "❌");

    // Verify USDT provider mapping (should be from previous setup)
    const usdtProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, USDT]
        )
    );
    const usdtProvider = await dataStore.getAddress(usdtProviderKey);
    console.log("\nUSDT provider verification:");
    console.log("- USDT provider:", usdtProvider);
    console.log("- Match:", usdtProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅" : "❌");

    // Test the prices through the provider
    console.log("\nTesting price retrieval from MockOracleProvider:");
    try {
        const usdtOraclePrice = await mockProvider.getOraclePrice(USDT, "0x");
        console.log("- USDT oracle price (min):", ethers.utils.formatUnits(usdtOraclePrice.min, 24), "(should be ~1500)");

        const mNGNOraclePrice = await mockProvider.getOraclePrice(mNGN, "0x");
        console.log("- mNGN oracle price (min):", ethers.utils.formatUnits(mNGNOraclePrice.min, 12), "(should be 1)");
    } catch (error) {
        console.log("Price test error:", error.message);
    }

    // Save configuration info
    const configInfo = {
        mNGN: mNGN,
        USDT: USDT,
        mockProvider: MOCK_PROVIDER,
        usdtPrice: usdtPrice.toString(),
        mNGNPrice: mNGNPrice.toString(),
        mNGNProviderKey: mNGNProviderKey,
        exchangeRate: "1 USDT = 1500 mNGN",
        configuredAt: new Date().toISOString(),
        network: "arbitrumSepolia"
    };

    const filePath = path.join(__dirname, 'mngn-oracle-config.json');
    fs.writeFileSync(filePath, JSON.stringify(configInfo, null, 2));
    console.log(`\n✅ Configuration saved to ${filePath}`);

    console.log("\n🎉 mNGN oracle configuration complete!");
    console.log("Ready to create deposits for the new mNGN markets.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });