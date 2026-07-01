const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting USDC Price in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const USDC = "0xe73B11Fb1e3eeEe8AF2a23079A4410Fe1B370548";

    // USDC price: $1 USD
    const USDC_PRICE = 1;

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("USDC:", USDC);
    console.log("Target price:", `$${USDC_PRICE} USD`);

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
    // USDC has 6 decimals
    // Price formula: actual_price * 10^(30 - token_decimals)
    // Price = 1 * 10^(30-6) = 1 * 10^24
    const price30Decimals = ethers.BigNumber.from(10).pow(24);

    console.log("\n📊 Price Calculation:");
    console.log("  Token decimals: 6");
    console.log("  Price with 30 decimals:", price30Decimals.toString());
    console.log("  Formula: 1 × 10^(30-6) = 1 × 10^24");

    console.log("\n📍 Setting price in MockOracleProvider...");

    try {
        const tx = await mockProvider.setPriceWithPrecision(USDC, price30Decimals);
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

    console.log("\n✅ USDC price configuration complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
