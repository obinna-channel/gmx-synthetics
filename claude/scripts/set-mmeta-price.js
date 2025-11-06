const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting mMETA Price in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mMETA = "0xE2f8B015D23bB0EFdD57D8C08a328180437D031D";

    // META price: $708.63
    const META_PRICE_USD = 708.63;

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mMETA:", mMETA);
    console.log("Target price:", `$${META_PRICE_USD}`);

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
    // mMETA has 18 decimals
    // Price formula: actual_price * 10^(30 - token_decimals)
    // Price = 708.63 * 10^(30-18) = 708.63 * 10^12
    // Convert 708.63 to integer cents (70863), then multiply by 10^10 to get 708.63 * 10^12
    const priceInCents = Math.floor(META_PRICE_USD * 100); // 70863
    const price30Decimals = ethers.BigNumber.from(priceInCents).mul(ethers.BigNumber.from(10).pow(10));

    console.log("\n📊 Price Calculation:");
    console.log("  Token decimals: 18");
    console.log("  Price with 30 decimals:", price30Decimals.toString());
    console.log("  Formula: $708.63 × 10^(30-18) = $708.63 × 10^12");

    console.log("\n📍 Setting price in MockOracleProvider...");

    try {
        const tx = await mockProvider.setPriceWithPrecision(mMETA, price30Decimals);
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

    console.log("\n✅ mMETA price configuration complete!");
    console.log("\n🎯 Next steps:");
    console.log("1. Add mMETA to config/tokens.ts");
    console.log("2. Add META market to config/markets.ts");
    console.log("3. Add perp config to scripts/validateMarketConfigsUtils.ts");
    console.log("4. Deploy market via hardhat");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
