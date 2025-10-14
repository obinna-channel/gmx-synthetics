const { ethers } = require("hardhat");

async function main() {
    console.log("=== Debug Position PnL from Reader Contract ===\n");

    const [signer] = await ethers.getSigners();

    // Contract addresses (from client/src/contracts/addresses.js)
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const REFERRAL_STORAGE = "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547";
    const MARKET = "0x5E63276Caae0FF49b2762b98A1d37941AA50F804"; // Current USDTNGN market

    // YOUR WALLET ADDRESS HERE - replace with the address that has the open position
    const ACCOUNT = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44"; // Update this!

    // Get Reader contract
    const reader = await ethers.getContractAt("Reader", READER);

    console.log("📋 Setup:");
    console.log("   Account:", ACCOUNT);
    console.log("   Market:", MARKET);
    console.log("   Reader:", READER);

    // Get price from command line argument, env variable, or use default
    const CURRENT_PRICE = parseFloat(
        process.argv[2] ||
        process.env.PRICE ||
        "1400"
    );

    if (!CURRENT_PRICE || CURRENT_PRICE <= 0) {
        console.error("\n❌ Invalid price! Please provide a valid price.");
        console.log("\nUsage:");
        console.log("   npx hardhat run claude/scripts/debug-position-pnl.js --network arbitrumSepolia 1650");
        console.log("   OR");
        console.log("   PRICE=1650 npx hardhat run claude/scripts/debug-position-pnl.js --network arbitrumSepolia");
        process.exit(1);
    }

    console.log("\n💰 Price Setup:");
    console.log("   Current Market Price (NGN/USD):", CURRENT_PRICE);

    // Build market prices payload - testing THREE different approaches
    console.log("\n🧪 Testing 3 different price configurations:\n");

    const approaches = [
        {
            name: "Approach 1: CORRECT - Token-specific decimals (from keeper)",
            description: "Index(18 dec)=price*10^12, Long(6 dec)=1*10^24, Short(18 dec)=(1/price)*10^12",
            prices: {
                indexTokenPrice: {
                    min: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 12), // mNGN has 18 decimals: 30-18=12
                    max: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 12)
                },
                longTokenPrice: {
                    min: ethers.utils.parseUnits("1", 24), // mUSD has 6 decimals: 30-6=24
                    max: ethers.utils.parseUnits("1", 24)
                },
                shortTokenPrice: {
                    min: ethers.utils.parseUnits((1 / CURRENT_PRICE).toFixed(12), 12), // mNGN has 18 decimals: 30-18=12
                    max: ethers.utils.parseUnits((1 / CURRENT_PRICE).toFixed(12), 12)
                }
            }
        },
        {
            name: "Approach 2: WRONG - All 30 decimals (what you had before)",
            description: "Index=price*10^30, Long=1*10^30, Short=(1/price)*10^30",
            prices: {
                indexTokenPrice: {
                    min: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 30),
                    max: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 30)
                },
                longTokenPrice: {
                    min: ethers.utils.parseUnits("1", 30),
                    max: ethers.utils.parseUnits("1", 30)
                },
                shortTokenPrice: {
                    min: ethers.utils.parseUnits((1 / CURRENT_PRICE).toFixed(18), 30),
                    max: ethers.utils.parseUnits((1 / CURRENT_PRICE).toFixed(18), 30)
                }
            }
        },
        {
            name: "Approach 3: WRONG - All same price (old broken version)",
            description: "All tokens get same price value",
            prices: {
                indexTokenPrice: {
                    min: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 30),
                    max: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 30)
                },
                longTokenPrice: {
                    min: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 30),
                    max: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 30)
                },
                shortTokenPrice: {
                    min: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 30),
                    max: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 30)
                }
            }
        }
    ];

    // Try each approach
    for (let i = 0; i < approaches.length; i++) {
        const approach = approaches[i];
        console.log(`\n${"=".repeat(60)}`);
        console.log(`${approach.name}`);
        console.log(`${approach.description}`);
        console.log(`${"=".repeat(60)}\n`);

        try {
            // Call getAccountPositionInfoList
            const positions = await reader.getAccountPositionInfoList(
                DATA_STORE,
                REFERRAL_STORAGE,
                ACCOUNT,
                [MARKET],
                [approach.prices],
                "0x0000000000000000000000000000000000000000", // uiFeeReceiver
                0, // start
                1000 // limit
            );

            console.log(`Found ${positions.length} positions\n`);

            if (positions.length === 0) {
                console.log("❌ No positions found - position might be closed or address is wrong\n");
                continue;
            }

            // Display each position
            positions.forEach((positionInfo, idx) => {
                console.log(`--- Position ${idx + 1} ---`);

                const { position, fees, basePnlUsd } = positionInfo;
                const { addresses, numbers, flags } = position;

                console.log("\n📍 Position Details:");
                console.log("   Market:", addresses.market);
                console.log("   Collateral Token:", addresses.collateralToken);
                console.log("   Is Long:", flags.isLong);

                console.log("\n📊 Size & Collateral:");
                const sizeInUsd = ethers.utils.formatUnits(numbers.sizeInUsd, 30);
                const sizeInTokens = ethers.utils.formatUnits(numbers.sizeInTokens, 18);
                const collateralAmount = ethers.utils.formatUnits(numbers.collateralAmount, 6);

                console.log("   Size in USD:", sizeInUsd);
                console.log("   Size in Tokens:", sizeInTokens);
                console.log("   Collateral (USDT):", collateralAmount);
                console.log("   Leverage:", (parseFloat(sizeInUsd) / parseFloat(collateralAmount)).toFixed(2) + "x");

                // Calculate entry price
                const entryPrice = parseFloat(sizeInUsd) / parseFloat(sizeInTokens);
                console.log("   Entry Price:", entryPrice.toFixed(2));

                console.log("\n💵 PnL & Fees Breakdown:");

                // Gross PnL
                const grossPnl = ethers.utils.formatUnits(basePnlUsd, 30);
                console.log("   📈 Gross PnL (USD):", grossPnl, grossPnl == "0.0" ? "❌ ZERO!" : "✅");

                // Fees breakdown
                const borrowingFeeUsd = ethers.utils.formatUnits(fees.borrowing.borrowingFeeUsd, 30);
                const fundingFeeAmount = ethers.utils.formatUnits(fees.funding.fundingFeeAmount, 6); // In USDT
                const positionFeeAmount = ethers.utils.formatUnits(fees.positionFeeAmount, 6); // In USDT
                const totalCostUsd = ethers.utils.formatUnits(fees.totalCostAmount, 30);

                console.log("\n   💸 Fees:");
                console.log("      Borrowing Fee (USD):", borrowingFeeUsd);
                console.log("      Funding Fee (USDT):", fundingFeeAmount);
                console.log("      Position Fee (USDT):", positionFeeAmount);
                console.log("      Total Fees (USD):", totalCostUsd);

                // Net PnL
                const netPnl = parseFloat(grossPnl) - parseFloat(totalCostUsd);
                console.log("\n   💰 Net PnL (Gross - Fees):", netPnl.toFixed(4), "USD");

                // Claimable funding
                const claimableLong = ethers.utils.formatUnits(fees.funding.claimableLongTokenAmount, 6);
                const claimableShort = ethers.utils.formatUnits(fees.funding.claimableShortTokenAmount, 18);
                console.log("\n   🎁 Claimable Funding:");
                console.log("      Long Token (mUSD):", claimableLong);
                console.log("      Short Token (mNGN):", claimableShort);

                console.log("\n⏰ Timing:");
                if (numbers.increasedAtTime > 0) {
                    const date = new Date(numbers.increasedAtTime.toNumber() * 1000);
                    console.log("   Opened at:", date.toLocaleString());
                }

                console.log("\n🔍 Raw Values (for debugging):");
                console.log("   basePnlUsd (raw):", basePnlUsd.toString());
                console.log("   sizeInUsd (raw):", numbers.sizeInUsd.toString());
                console.log("   sizeInTokens (raw):", numbers.sizeInTokens.toString());
            });

        } catch (error) {
            console.log("❌ Error with this approach:");
            console.log(error.message);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎯 Next Steps:");
    console.log("   1. Check which approach shows non-zero PnL");
    console.log("   2. Update usePositionReader.js to use that approach");
    console.log("   3. Verify the entry price makes sense");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
