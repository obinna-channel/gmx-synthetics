const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting mUSDTARS Price in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mUSDTARS = "0xed6890bE2409F0db06a00C809a298E2E06553BE1";

    // USDT/ARS price: 1 USDT = 1,458.51 ARS
    const USDTARS_RATE = 1458.51;

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mUSDTARS:", mUSDTARS);
    console.log("Target price:", `${USDTARS_RATE} ARS per USDT`);

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
    // mUSDTARS has 18 decimals
    // Price formula: actual_price * 10^(30 - token_decimals)
    // Price = 1458.51 * 10^(30-18) = 1458.51 * 10^12
    const priceInteger = Math.floor(USDTARS_RATE * 100); // 145851 (to handle 2 decimal places)
    const price30Decimals = ethers.BigNumber.from(priceInteger).mul(ethers.BigNumber.from(10).pow(10));

    console.log("\n📊 Price Calculation:");
    console.log("  Token decimals: 18");
    console.log("  Price with 30 decimals:", price30Decimals.toString());
    console.log("  Formula: 1458.51 × 10^(30-18) = 1458.51 × 10^12");
    console.log("  Computed: 145851 × 10^10 =", price30Decimals.toString());

    console.log("\n📍 Setting price in MockOracleProvider...");

    try {
        const tx = await mockProvider.setPriceWithPrecision(mUSDTARS, price30Decimals);
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

    console.log("\n✅ mUSDTARS price configuration complete!");
    console.log("\n🎯 Next step: Add mUSDTARS to config/tokens.ts");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
