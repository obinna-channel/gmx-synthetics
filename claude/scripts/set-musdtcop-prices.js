const { ethers } = require("hardhat");
const https = require("https");

async function fetchPriceFromAPI() {
    const API_URL = "https://marks-server-a58cc19eb539.herokuapp.com/api/v1/price/current/USDTCOP";

    return new Promise((resolve, reject) => {
        https.get(API_URL, { timeout: 10000 }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response && response.price) {
                        resolve(response.price);
                    } else {
                        reject(new Error("Invalid API response: no price field"));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse API response: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`API request failed: ${error.message}`));
        });
    });
}

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Setting mUSDTCOP and mUSD Prices in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mUSDTCOP = "0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8"; // Index token (18 decimals)
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"; // Collateral token (6 decimals)

    // Fetch current exchange rate from API
    console.log("📡 Fetching current USDTCOP price from API...");
    let EXCHANGE_RATE;
    try {
        EXCHANGE_RATE = await fetchPriceFromAPI();
        console.log(`✅ Fetched rate: 1 USD = ${EXCHANGE_RATE} COP\n`);
    } catch (error) {
        console.log(`❌ Failed to fetch price from API: ${error.message}`);
        console.log("   Using fallback rate: 1 USD = 4400 COP\n");
        EXCHANGE_RATE = 4400;
    }

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mUSDTCOP:", mUSDTCOP);
    console.log("mUSD:", mUSD);
    console.log("\nPrice Configuration:");
    console.log("  mUSDTCOP (index): " + EXCHANGE_RATE + " (tracks USDT/COP exchange rate)");
    console.log("  mUSD (collateral): 1 USD");

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

    // Calculate prices with 30 decimals precision
    // Formula: actual_price * 10^(30 - token_decimals)

    // mUSDTCOP: 18 decimals
    // Price = exchange_rate * 10^(30-18) = exchange_rate * 10^12
    // Handle decimal by converting to integer representation
    // e.g., 4400.50 -> 440050 * 10^10
    const rateInteger = Math.floor(EXCHANGE_RATE * 100); // Convert to integer (e.g., 4400.50 -> 440050)
    const musdtCopPrice = ethers.BigNumber.from(rateInteger).mul(ethers.BigNumber.from(10).pow(10));

    // mUSD: 6 decimals, price = 1 USD
    // Price = 1 * 10^(30-6) = 1 * 10^24
    const musdPrice = ethers.BigNumber.from(10).pow(24);

    console.log("\n📊 Price Calculations:");
    console.log("  mUSDTCOP (18 decimals):");
    console.log("    Formula: " + EXCHANGE_RATE + " × 10^12");
    console.log("    Implementation: " + rateInteger + " × 10^10 (handling decimals)");
    console.log("    Value:", musdtCopPrice.toString());
    console.log("  mUSD (6 decimals):");
    console.log("    Formula: 1 × 10^(30-6) = 1 × 10^24");
    console.log("    Value:", musdPrice.toString());

    try {
        // Set mUSDTCOP price
        console.log("\n📍 Step 1: Setting mUSDTCOP price...");
        const tx1 = await mockProvider.setPriceWithPrecision(mUSDTCOP, musdtCopPrice);
        console.log("  TX sent:", tx1.hash);
        await tx1.wait();
        console.log("  ✅ mUSDTCOP price set to", EXCHANGE_RATE);

        // Set mUSD price
        console.log("\n📍 Step 2: Setting mUSD price...");
        const tx2 = await mockProvider.setPriceWithPrecision(mUSD, musdPrice);
        console.log("  TX sent:", tx2.hash);
        await tx2.wait();
        console.log("  ✅ mUSD price set to 1 USD");

        console.log("\n✅ All prices successfully updated!");
        console.log("\n🎯 Next steps:");
        console.log("  1. Create deposit with: AMOUNT=100000 npx hardhat run claude/scripts/create-deposit-usdtcop-amount.js --network arbitrumSepolia");
        console.log("  2. Execute deposit with: npx hardhat run claude/scripts/execute-deposit-usdtcop.js --network arbitrumSepolia");

    } catch (error) {
        console.log("\n❌ Failed to set prices:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
