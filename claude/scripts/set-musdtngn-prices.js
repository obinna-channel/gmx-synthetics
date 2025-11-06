const { ethers } = require("hardhat");
const https = require("https");

async function fetchPriceFromAPI() {
    const API_URL = "https://marks-server-a58cc19eb539.herokuapp.com/api/v1/price/current/USDTNGN";

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
    console.log("=== Setting mUSDTNGN and mUSD Prices in MockOracleProvider ===\n");
    console.log("Signer:", signer.address);

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73"; // Index token (18 decimals)
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf"; // Collateral token (6 decimals)

    // Fetch current exchange rate from API
    console.log("📡 Fetching current USDTNGN price from API...");
    let EXCHANGE_RATE;
    try {
        EXCHANGE_RATE = await fetchPriceFromAPI();
        console.log(`✅ Fetched rate: 1 USD = ${EXCHANGE_RATE} NGN\n`);
    } catch (error) {
        console.log(`❌ Failed to fetch price from API: ${error.message}`);
        console.log("   Using fallback rate: 1 USD = 1500 NGN\n");
        EXCHANGE_RATE = 1500;
    }

    console.log("Mock Provider:", MOCK_PROVIDER);
    console.log("mUSDTNGN:", mUSDTNGN);
    console.log("mUSD:", mUSD);
    console.log("\nPrice Configuration:");
    console.log("  mUSDTNGN (index): " + EXCHANGE_RATE + " (tracks USDT/NGN exchange rate)");
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

    // mUSDTNGN: 18 decimals
    // Price = exchange_rate * 10^(30-18) = exchange_rate * 10^12
    // Handle decimal by converting to integer representation
    // e.g., 1459.67 -> 145967 * 10^10
    const rateInteger = Math.floor(EXCHANGE_RATE * 100); // Convert to integer (e.g., 1459.67 -> 145967)
    const musdtNgnPrice = ethers.BigNumber.from(rateInteger).mul(ethers.BigNumber.from(10).pow(10));

    // mUSD: 6 decimals, price = 1 USD
    // Price = 1 * 10^(30-6) = 1 * 10^24
    const musdPrice = ethers.BigNumber.from(10).pow(24);

    console.log("\n📊 Price Calculations:");
    console.log("  mUSDTNGN (18 decimals):");
    console.log("    Formula: " + EXCHANGE_RATE + " × 10^12");
    console.log("    Implementation: " + rateInteger + " × 10^10 (handling decimals)");
    console.log("    Value:", musdtNgnPrice.toString());
    console.log("  mUSD (6 decimals):");
    console.log("    Formula: 1 × 10^(30-6) = 1 × 10^24");
    console.log("    Value:", musdPrice.toString());

    try {
        // Set mUSDTNGN price
        console.log("\n📍 Step 1: Setting mUSDTNGN price...");
        const tx1 = await mockProvider.setPriceWithPrecision(mUSDTNGN, musdtNgnPrice);
        console.log("  TX sent:", tx1.hash);
        await tx1.wait();
        console.log("  ✅ mUSDTNGN price set to", EXCHANGE_RATE);

        // Set mUSD price
        console.log("\n📍 Step 2: Setting mUSD price...");
        const tx2 = await mockProvider.setPriceWithPrecision(mUSD, musdPrice);
        console.log("  TX sent:", tx2.hash);
        await tx2.wait();
        console.log("  ✅ mUSD price set to 1 USD");

        console.log("\n✅ All prices successfully updated!");
        console.log("\n🎯 Next steps:");
        console.log("  1. Create deposit with desired amount");
        console.log("  2. Execute deposit");

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
