const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("Configuring MockOracleProvider for mUSD markets...\n");

    // Contract addresses
    const DATASTORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";  // Your newly deployed mUSD
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827";

    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Get contract instances
    const dataStore = await ethers.getContractAt("DataStore", DATASTORE);
    const mockProvider = await ethers.getContractAt("contracts/oracle/MockOracleProvider.sol:MockOracleProvider", MOCK_PROVIDER);

    // Step 1: Set prices with exchange rate logic (NGN-based)
    // mUSD: 1 mUSD = 1500 NGN, so price is 1500 * 10^(30-6) = 1500 * 10^24
    const musdPrice = ethers.BigNumber.from("1500").mul(ethers.BigNumber.from("10").pow(24));

    // mNGN: 1 mNGN = 1 NGN, so price is 1 * 10^(30-18) = 10^12
    const mngnPrice = ethers.BigNumber.from("10").pow(12);

    console.log("Setting exchange rate prices (NGN-based):");
    console.log("- mUSD price: 1500 (1 mUSD = 1500 NGN)");
    console.log("  Raw value:", musdPrice.toString());
    console.log("- mNGN price: 1 (1 mNGN = 1 NGN)");
    console.log("  Raw value:", mngnPrice.toString());

    // Set mUSD price
    let tx = await mockProvider.setPriceWithPrecision(mUSD, musdPrice);
    await tx.wait();
    console.log("✅ mUSD price set to 1500\n");

    // Set mNGN price (in case it needs refresh)
    tx = await mockProvider.setPriceWithPrecision(mNGN, mngnPrice);
    await tx.wait();
    console.log("✅ mNGN price set to 1\n");

    // Step 2: Configure oracle provider for mUSD token
    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );

    // Set provider for mUSD
    const musdProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mUSD]
        )
    );

    console.log("Setting oracle provider mapping for mUSD...");
    tx = await dataStore.setAddress(musdProviderKey, MOCK_PROVIDER);
    await tx.wait();
    console.log("✅ Oracle provider mapping set for mUSD\n");

    // Verify the configuration
    const storedProvider = await dataStore.getAddress(musdProviderKey);
    console.log("Verification:");
    console.log("- mUSD token:", mUSD);
    console.log("- Configured provider:", storedProvider);
    console.log("- Expected provider:", MOCK_PROVIDER);
    console.log("- Match:", storedProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅" : "❌");

    // Verify mNGN provider mapping
    const mngnProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mNGN]
        )
    );
    const mngnProvider = await dataStore.getAddress(mngnProviderKey);
    console.log("\nmNGN provider verification:");
    console.log("- mNGN provider:", mngnProvider);
    console.log("- Match:", mngnProvider.toLowerCase() === MOCK_PROVIDER.toLowerCase() ? "✅" : "❌");

    // Test the prices through the provider
    console.log("\nTesting price retrieval from MockOracleProvider:");
    try {
        const musdOraclePrice = await mockProvider.getOraclePrice(mUSD, "0x");
        console.log("- mUSD oracle price (min):", ethers.utils.formatUnits(musdOraclePrice.min, 24), "(should be 1500)");

        const mngnOraclePrice = await mockProvider.getOraclePrice(mNGN, "0x");
        console.log("- mNGN oracle price (min):", ethers.utils.formatUnits(mngnOraclePrice.min, 12), "(should be 1)");
    } catch (error) {
        console.log("Price test error:", error.message);
    }

    // Calculate expected deposit values
    console.log("\n📊 Exchange Rate Pricing Model:");
    console.log("- 1 mUSD = 1500 NGN");
    console.log("- 1 mNGN = 1 NGN");
    console.log("- Exchange rate: 1 mUSD = 1500 mNGN");
    console.log("\nFor initial deposit testing:");
    console.log("- Small: 10 mUSD + 15,000 mNGN = 30,000 NGN total liquidity");
    console.log("- Medium: 100 mUSD + 150,000 mNGN = 300,000 NGN total liquidity");
    console.log("- Large: 1000 mUSD + 1,500,000 mNGN = 3,000,000 NGN total liquidity");

    // Save configuration info
    const configInfo = {
        mUSD: mUSD,
        mNGN: mNGN,
        mockProvider: MOCK_PROVIDER,
        musdPrice: musdPrice.toString(),
        mngnPrice: mngnPrice.toString(),
        musdProviderKey: musdProviderKey,
        exchangeRate: "1 mUSD = 1500 mNGN",
        pricingModel: "NGN-based (exchange rate)",
        configuredAt: new Date().toISOString(),
        network: "arbitrumSepolia",
        market: "0xf7F4Bb2014A164A919Ccec2b97Bd4805f86B83aD"  // mUSD/mUSD/mNGN market
    };

    const filePath = path.join(__dirname, 'musd-oracle-config.json');
    fs.writeFileSync(filePath, JSON.stringify(configInfo, null, 2));
    console.log(`\n✅ Configuration saved to ${filePath}`);

    console.log("\n🎉 mUSD oracle configuration complete!");
    console.log("Ready to test deposits with smaller amounts in the mUSD/mUSD/mNGN market.");
    console.log("\nMarket address: 0xf7F4Bb2014A164A919Ccec2b97Bd4805f86B83aD");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });