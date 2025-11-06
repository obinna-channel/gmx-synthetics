const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting mNVDA and mUSD Prices in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mNVDA = "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    // NVDA price: $180.00
    const NVDA_PRICE_USD = 180.00;
    // mUSD price: $1.00
    const USD_PRICE = 1.00;

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mNVDA:", mNVDA);
    console.log("Target mNVDA price:", `$${NVDA_PRICE_USD}`);
    console.log("mUSD:", mUSD);
    console.log("Target mUSD price:", `$${USD_PRICE}`);

    // MockOracleProvider ABI
    const mockProviderAbi = [
        {
            "inputs": [
                {"name": "token", "type": "address"},
                {"name": "price", "type": "uint256"}
            ],
            "name": "setPriceWithPrecision",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ];

    const mockProvider = await ethers.getContractAt(mockProviderAbi, MOCK_PROVIDER);

    // Calculate mNVDA price with 30 decimals precision
    // mNVDA has 18 decimals
    // Price formula: actual_price * 10^(30 - token_decimals)
    // Price = 180.00 * 10^(30-18) = 180.00 * 10^12
    const nvdaPriceInteger = Math.floor(NVDA_PRICE_USD * 100); // 18000 (to handle 2 decimal places)
    const nvdaPrice30Decimals = ethers.BigNumber.from(nvdaPriceInteger).mul(ethers.BigNumber.from(10).pow(10));

    // Calculate mUSD price with 30 decimals precision
    // mUSD has 6 decimals
    // Price formula: actual_price * 10^(30 - token_decimals)
    // Price = 1.00 * 10^(30-6) = 1 * 10^24
    const musdPrice30Decimals = ethers.BigNumber.from(1).mul(ethers.BigNumber.from(10).pow(24));

    console.log("\n📊 Price Calculations:");
    console.log("  mNVDA (18 decimals):");
    console.log("    Formula: 180.00 × 10^(30-18) = 180.00 × 10^12");
    console.log("    Computed: 18000 × 10^10 =", nvdaPrice30Decimals.toString());
    console.log("  mUSD (6 decimals):");
    console.log("    Formula: 1.00 × 10^(30-6) = 1 × 10^24");
    console.log("    Value:", musdPrice30Decimals.toString());

    console.log("\n📍 Setting prices in MockOracleProvider...");

    try {
        // Set mNVDA price
        console.log("  Setting mNVDA price...");
        let tx = await mockProvider.setPriceWithPrecision(mNVDA, nvdaPrice30Decimals);
        console.log("    TX sent:", tx.hash);
        let receipt = await tx.wait();
        if (receipt.status === 1) {
            console.log("    ✅ mNVDA price set successfully!");
        }

        // Set mUSD price
        console.log("  Setting mUSD price...");
        tx = await mockProvider.setPriceWithPrecision(mUSD, musdPrice30Decimals);
        console.log("    TX sent:", tx.hash);
        receipt = await tx.wait();
        if (receipt.status === 1) {
            console.log("    ✅ mUSD price set successfully!");
        }

        console.log("\n✅ Both prices configured successfully!");
        console.log("  mNVDA: $180.00");
        console.log("  mUSD: $1.00");
    } catch (error) {
        console.log("  ❌ Failed to set prices:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
