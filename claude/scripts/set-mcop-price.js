const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting mCOP Price in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mCOP = "0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8";

    // USDT/COP price: 1 USDT = 3,865.50 COP
    const USDTCOP_RATE = 3865.50;

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mCOP:", mCOP);
    console.log("Target price:", `${USDTCOP_RATE} COP per USDT`);

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
    // mCOP has 18 decimals
    // Price formula: actual_price * 10^(30 - token_decimals)
    // Price = 3865.50 * 10^(30-18) = 3865.50 * 10^12
    // Handle decimal places: 3865.50 = 386550 / 100
    const priceInteger = Math.floor(USDTCOP_RATE * 100); // 386550 (to handle 2 decimal places)
    const price30Decimals = ethers.BigNumber.from(priceInteger).mul(ethers.BigNumber.from(10).pow(10));

    console.log("\n📊 Price Calculation:");
    console.log("  Token decimals: 18");
    console.log("  Price with 30 decimals:", price30Decimals.toString());
    console.log("  Formula: 3865.50 × 10^(30-18) = 3865.50 × 10^12");
    console.log("  Computed: 386550 × 10^10 =", price30Decimals.toString());

    console.log("\n📍 Setting price in MockOracleProvider...");

    try {
        const tx = await mockProvider.setPriceWithPrecision(mCOP, price30Decimals);
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

    console.log("\n✅ mCOP price configuration complete!");
    console.log("\n🎯 Next step: Add mCOP to config/tokens.ts");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
