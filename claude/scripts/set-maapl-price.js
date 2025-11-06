const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting mAAPL Price in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mAAPL = "0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e";

    // AAPL price: $247.59
    const AAPL_PRICE_USD = "247.59";

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mAAPL:", mAAPL);
    console.log("Target price:", `$${AAPL_PRICE_USD}`);

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
    // mAAPL has 18 decimals
    // Price formula: actual_price * 10^(30 - token_decimals)
    // Price = 247.59 * 10^(30-18) = 247.59 * 10^12
    const price30Decimals = ethers.utils.parseUnits(AAPL_PRICE_USD, 12);

    console.log("\n📊 Price Calculation:");
    console.log("  Token decimals: 18");
    console.log("  Price with 30 decimals:", price30Decimals.toString());
    console.log("  Formula: $247.59 × 10^(30-18) = $247.59 × 10^12");

    console.log("\n📍 Setting price in MockOracleProvider...");

    try {
        const tx = await mockProvider.setPriceWithPrecision(mAAPL, price30Decimals);
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

    console.log("\n✅ mAAPL price configuration complete!");
    console.log("\n🎯 Next steps:");
    console.log("1. Add mAAPL to config/tokens.ts");
    console.log("2. Add AAPL market to config/markets.ts");
    console.log("3. Deploy AAPL market using hardhat deploy");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
