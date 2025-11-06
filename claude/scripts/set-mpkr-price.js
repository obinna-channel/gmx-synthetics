const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting mPKR Price in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mPKR = "0xDC7e9F5a3D337161880d084131BC16214f2F8EBD";

    // USDT/PKR price: 1 USDT = 289.71 PKR
    const USDTPKR_RATE = 289.71;

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mPKR:", mPKR);
    console.log("Target price:", `${USDTPKR_RATE} PKR per USDT`);

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
    // mPKR has 18 decimals
    // Price formula: actual_price * 10^(30 - token_decimals)
    // Price = 289.71 * 10^(30-18) = 289.71 * 10^12
    // Handle decimal places: 289.71 = 28971 / 100
    const priceInteger = Math.floor(USDTPKR_RATE * 100); // 28971 (to handle 2 decimal places)
    const price30Decimals = ethers.BigNumber.from(priceInteger).mul(ethers.BigNumber.from(10).pow(10));

    console.log("\n📊 Price Calculation:");
    console.log("  Token decimals: 18");
    console.log("  Price with 30 decimals:", price30Decimals.toString());
    console.log("  Formula: 289.71 × 10^(30-18) = 289.71 × 10^12");
    console.log("  Computed: 28971 × 10^10 =", price30Decimals.toString());

    console.log("\n📍 Setting price in MockOracleProvider...");

    try {
        const tx = await mockProvider.setPriceWithPrecision(mPKR, price30Decimals);
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

    console.log("\n✅ mPKR price configuration complete!");
    console.log("\n🎯 Next step: Add mPKR to config/tokens.ts");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
