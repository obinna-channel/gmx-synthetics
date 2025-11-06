const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting mTSLA Price in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mTSLA = "0x77d4DdD2E847592fb7710e342C0492A4b85655f4";

    // TSLA price: $428
    const TSLA_PRICE_USD = 428;

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mTSLA:", mTSLA);
    console.log("Target price:", `$${TSLA_PRICE_USD}`);

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

    // Calculate price with 30 decimals precision
    // mTSLA has 18 decimals
    // Price formula: actual_price * 10^(30 - token_decimals)
    // Price = 428 * 10^(30-18) = 428 * 10^12
    const price30Decimals = ethers.BigNumber.from(TSLA_PRICE_USD).mul(ethers.BigNumber.from(10).pow(12));

    console.log("\n📊 Price Calculation:");
    console.log("  Token decimals: 18");
    console.log("  Price with 30 decimals:", price30Decimals.toString());
    console.log("  Formula: $428 × 10^(30-18) = $428 × 10^12");

    console.log("\n📍 Setting price in MockOracleProvider...");

    try {
        const tx = await mockProvider.setPriceWithPrecision(mTSLA, price30Decimals);
        console.log("  TX sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log("  ✅ Price set successfully!");
            console.log("  Block:", receipt.blockNumber);
            console.log("  Gas used:", receipt.gasUsed.toString());
        } else {
            console.log("  ❌ Transaction failed");
        }
    } catch (error) {
        console.log("  ❌ Failed to set price:", error.message);
    }

    console.log("\n✅ mTSLA price configuration complete!");
    console.log("\n🎯 Next step: Run create-deposit-tsla-market.js to add initial liquidity");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
