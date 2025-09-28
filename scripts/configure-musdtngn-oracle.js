const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Configuring Oracle Prices for mUSDTNGN Market ===\n");
    console.log("Signer:", signer.address);

    // Contract addresses
    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";

    // Token addresses
    const mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73"; // Index token (18 decimals)
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"; // Long token (6 decimals)
    const mNGN = "0x2e08218698339AFdba205312cc23dAe8c3690827"; // Short token (18 decimals)

    // Get contracts
    const mockProvider = await ethers.getContractAt(
        "contracts/oracle/MockOracleProvider.sol:MockOracleProvider",
        MOCK_PROVIDER
    );

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Current exchange rate: 1 USD = 1500 NGN
    const EXCHANGE_RATE = 1500;

    console.log("📊 Price Configuration:");
    console.log("  Exchange Rate: 1 USD = " + EXCHANGE_RATE + " NGN\n");

    // 1. Set mUSDTNGN price (the index token representing USDT/NGN rate)
    // This should be the exchange rate itself: 1500
    // With 18 decimals, precision 30: 30 - 18 = 12
    const musdtNgnPrice = ethers.utils.parseUnits(EXCHANGE_RATE.toString(), 12);
    console.log("📍 Setting mUSDTNGN price to", EXCHANGE_RATE, "(USDT/NGN rate)");
    console.log("  Raw price:", musdtNgnPrice.toString());

    let tx = await mockProvider.setPriceWithPrecision(mUSDTNGN, musdtNgnPrice);
    await tx.wait();
    console.log("  ✅ mUSDTNGN price set\n");

    // 2. Set mUSD price to 1 USD
    // With 6 decimals, precision 30: 30 - 6 = 24
    const musdPrice = ethers.utils.parseUnits("1", 24);
    console.log("📍 Setting mUSD price to 1 USD");
    console.log("  Raw price:", musdPrice.toString());

    tx = await mockProvider.setPriceWithPrecision(mUSD, musdPrice);
    await tx.wait();
    console.log("  ✅ mUSD price set\n");

    // 3. Set mNGN price to 1/EXCHANGE_RATE USD (e.g., 0.000666667 for 1500)
    // With 18 decimals, precision 30: 30 - 18 = 12
    // Price = 1/1500 = 0.000666667
    const mngnPriceInUsd = (1 / EXCHANGE_RATE).toFixed(9);
    const mngnPrice = ethers.utils.parseUnits(mngnPriceInUsd, 12);
    console.log("📍 Setting mNGN price to", mngnPriceInUsd, "USD (1/" + EXCHANGE_RATE + ")");
    console.log("  Raw price:", mngnPrice.toString());

    tx = await mockProvider.setPriceWithPrecision(mNGN, mngnPrice);
    await tx.wait();
    console.log("  ✅ mNGN price set\n");

    // Configure oracle providers using DataStore (like the mUSD script)
    console.log("📍 Configuring oracle providers in DataStore...");

    const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
    );

    // Set provider for mUSDTNGN
    const musdtNgnProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mUSDTNGN]
        )
    );
    tx = await dataStore.setAddress(musdtNgnProviderKey, MOCK_PROVIDER);
    await tx.wait();
    console.log("  ✅ Provider set for mUSDTNGN");

    // Set provider for mUSD (refresh/ensure)
    const musdProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mUSD]
        )
    );
    tx = await dataStore.setAddress(musdProviderKey, MOCK_PROVIDER);
    await tx.wait();
    console.log("  ✅ Provider set for mUSD");

    // Set provider for mNGN (refresh/ensure)
    const mngnProviderKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, mNGN]
        )
    );
    tx = await dataStore.setAddress(mngnProviderKey, MOCK_PROVIDER);
    await tx.wait();
    console.log("  ✅ Provider set for mNGN");

    console.log("\n✅ Oracle configuration complete!");
    console.log("\n📊 Summary:");
    console.log("  mUSDTNGN: " + EXCHANGE_RATE + " (index tracking USDT/NGN rate)");
    console.log("  mUSD: 1 USD");
    console.log("  mNGN: " + mngnPriceInUsd + " USD");
    console.log("\n🎯 Next Steps:");
    console.log("  1. Deploy market with mUSDTNGN as index, mUSD as long, mNGN as short");
    console.log("  2. Fund the market with initial liquidity");
    console.log("  3. Test position P&L with price changes");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });