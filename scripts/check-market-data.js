const { ethers } = require("hardhat");

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Contract addresses
const ADDRESSES = {
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",

    // Markets
    TSLA_MARKET: "0x8ae559448a1482faffC925eF6a233276588348Df",
    USDTNGN_MARKET: "0x5E63276Caae0FF49b2762b98A1d37941AA50F804",
    USDTARS_MARKET: "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69",

    // Tokens
    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827",
    mTSLA: "0x77d4DdD2E847592fb7710e342C0492A4b85655f4",
    mUSDTARS: "0xed6890bE2409F0db06a00C809a298E2E06553BE1",
};

async function checkMarketData() {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}=== Querying Market Data from Reader ===${colors.reset}`);
    console.log(`Reader: ${colors.cyan}${ADDRESSES.READER}${colors.reset}`);
    console.log(`DataStore: ${colors.cyan}${ADDRESSES.DATA_STORE}${colors.reset}\n`);

    // Get Reader contract
    const reader = await ethers.getContractAt("Reader", ADDRESSES.READER);

    // Define markets to check
    const markets = [
        { name: "TSLA", address: ADDRESSES.TSLA_MARKET, indexToken: ADDRESSES.mTSLA, longToken: ADDRESSES.mUSD, shortToken: ADDRESSES.mUSD },
        { name: "USDTNGN", address: ADDRESSES.USDTNGN_MARKET, indexToken: "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73", longToken: ADDRESSES.mUSD, shortToken: ADDRESSES.mNGN },
        { name: "USDTARS", address: ADDRESSES.USDTARS_MARKET, indexToken: ADDRESSES.mUSDTARS, longToken: ADDRESSES.mUSD, shortToken: ADDRESSES.mUSD }
    ];

    // Create price data for markets
    const marketPrices = [
        // TSLA
        {
            indexTokenPrice: {
                min: ethers.utils.parseUnits("407", 12),
                max: ethers.utils.parseUnits("407", 12)
            },
            longTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),
                max: ethers.utils.parseUnits("1", 24)
            },
            shortTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),
                max: ethers.utils.parseUnits("1", 24)
            }
        },
        // USDTNGN
        {
            indexTokenPrice: {
                min: ethers.utils.parseUnits("1500", 12),
                max: ethers.utils.parseUnits("1500", 12)
            },
            longTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),
                max: ethers.utils.parseUnits("1", 24)
            },
            shortTokenPrice: {
                min: ethers.utils.parseUnits((1 / 1500).toFixed(12), 12),
                max: ethers.utils.parseUnits((1 / 1500).toFixed(12), 12)
            }
        },
        // USDTARS
        {
            indexTokenPrice: {
                min: ethers.utils.parseUnits("1000", 12),
                max: ethers.utils.parseUnits("1000", 12)
            },
            longTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),
                max: ethers.utils.parseUnits("1", 24)
            },
            shortTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),
                max: ethers.utils.parseUnits("1", 24)
            }
        }
    ];

    for (let i = 0; i < markets.length; i++) {
        const market = markets[i];
        const prices = marketPrices[i];

        console.log(`${colors.bright}${"=".repeat(80)}${colors.reset}`);
        console.log(`${colors.bright}=== ${market.name} Market ===${colors.reset}`);
        console.log(`${colors.bright}${"=".repeat(80)}${colors.reset}`);
        console.log(`Market Address: ${colors.cyan}${market.address}${colors.reset}`);
        console.log(`Index Token: ${colors.yellow}${market.indexToken}${colors.reset}`);
        console.log(`Long Token: ${colors.yellow}${market.longToken}${colors.reset}`);
        console.log(`Short Token: ${colors.yellow}${market.shortToken}${colors.reset}\n`);

        try {
            // Get market info
            const marketInfo = await reader.getMarketInfo(
                ADDRESSES.DATA_STORE,
                prices,
                market.address
            );

            // Debug: Log the entire structure
            console.log(`${colors.bright}Raw Market Info Structure:${colors.reset}`);
            console.log(JSON.stringify(marketInfo, null, 2));
            console.log("\n");

            console.log(`${colors.bright}Market Info:${colors.reset}`);
            console.log(`  Market Token: ${marketInfo.market ? marketInfo.market.marketToken : 'N/A'}`);
            console.log(`  Index Token: ${marketInfo.market ? marketInfo.market.indexToken : 'N/A'}`);
            console.log(`  Long Token: ${marketInfo.market ? marketInfo.market.longToken : 'N/A'}`);
            console.log(`  Short Token: ${marketInfo.market ? marketInfo.market.shortToken : 'N/A'}`);

            console.log(`\n${colors.bright}Pool Amounts:${colors.reset}`);
            console.log(`  Long Token Pool: ${colors.green}${ethers.utils.formatUnits(marketInfo.poolValueInfo.longTokenAmount, 6)} mUSD${colors.reset}`);
            if (market.shortToken === ADDRESSES.mUSD) {
                console.log(`  Short Token Pool: ${colors.green}${ethers.utils.formatUnits(marketInfo.poolValueInfo.shortTokenAmount, 6)} mUSD${colors.reset}`);
            } else if (market.shortToken === ADDRESSES.mNGN) {
                console.log(`  Short Token Pool: ${colors.green}${ethers.utils.formatUnits(marketInfo.poolValueInfo.shortTokenAmount, 18)} mNGN${colors.reset}`);
            }
            console.log(`  Pool Value (USD): ${colors.green}$${ethers.utils.formatUnits(marketInfo.poolValueInfo.poolValue, 30)}${colors.reset}`);

            console.log(`\n${colors.bright}Open Interest:${colors.reset}`);
            console.log(`  Long OI (USD): ${colors.green}$${ethers.utils.formatUnits(marketInfo.openInterestInfo.longOpenInterest, 30)}${colors.reset}`);
            console.log(`  Short OI (USD): ${colors.red}$${ethers.utils.formatUnits(marketInfo.openInterestInfo.shortOpenInterest, 30)}${colors.reset}`);
            console.log(`  Total OI (USD): ${colors.cyan}$${ethers.utils.formatUnits(marketInfo.openInterestInfo.longOpenInterest.add(marketInfo.openInterestInfo.shortOpenInterest), 30)}${colors.reset}`);

            // Calculate OI percentages
            const totalOI = marketInfo.openInterestInfo.longOpenInterest.add(marketInfo.openInterestInfo.shortOpenInterest);
            if (!totalOI.isZero()) {
                const longPercent = marketInfo.openInterestInfo.longOpenInterest.mul(10000).div(totalOI).toNumber() / 100;
                const shortPercent = marketInfo.openInterestInfo.shortOpenInterest.mul(10000).div(totalOI).toNumber() / 100;
                console.log(`  Long %: ${colors.green}${longPercent.toFixed(2)}%${colors.reset}`);
                console.log(`  Short %: ${colors.red}${shortPercent.toFixed(2)}%${colors.reset}`);
            }

            console.log(`\n${colors.bright}Borrowing Fees:${colors.reset}`);
            console.log(`  Long Borrowing Factor: ${marketInfo.borrowingFactorPerSecondForLongs.toString()}`);
            console.log(`  Short Borrowing Factor: ${marketInfo.borrowingFactorPerSecondForShorts.toString()}`);
            console.log(`  Long Borrowing Fee (USD): ${colors.yellow}$${ethers.utils.formatUnits(marketInfo.longInterestUsingLongToken, 30)}${colors.reset}`);
            console.log(`  Short Borrowing Fee (USD): ${colors.yellow}$${ethers.utils.formatUnits(marketInfo.longInterestUsingShortToken, 30)}${colors.reset}`);

            console.log(`\n${colors.bright}Funding:${colors.reset}`);
            console.log(`  Funding Factor Per Second: ${marketInfo.fundingFactorPerSecond.toString()}`);
            console.log(`  Long Token Funding Fee: ${marketInfo.netPnlForLongToken.toString()}`);
            console.log(`  Short Token Funding Fee: ${marketInfo.netPnlForShortToken.toString()}`);

            console.log(`\n${colors.bright}PnL:${colors.reset}`);
            console.log(`  PnL to Pool Factor (Longs): ${marketInfo.pnlToPoolFactorForLongs.toString()}`);
            console.log(`  PnL to Pool Factor (Shorts): ${marketInfo.pnlToPoolFactorForShorts.toString()}`);

            console.log(`\n${colors.bright}Reserved Amounts:${colors.reset}`);
            console.log(`  Reserved USD (Longs): $${ethers.utils.formatUnits(marketInfo.reservedUsdForLongs, 30)}`);
            console.log(`  Reserved USD (Shorts): $${ethers.utils.formatUnits(marketInfo.reservedUsdForShorts, 30)}`);

            console.log(`\n${colors.bright}Max Open Interest:${colors.reset}`);
            console.log(`  Max OI for Longs: $${ethers.utils.formatUnits(marketInfo.maxOpenInterestForLongs, 30)}`);
            console.log(`  Max OI for Shorts: $${ethers.utils.formatUnits(marketInfo.maxOpenInterestForShorts, 30)}`);

        } catch (error) {
            console.error(`${colors.red}Error querying ${market.name} market:${colors.reset}`, error.message);
        }

        console.log("");
    }
}

async function main() {
    try {
        await checkMarketData();
    } catch (error) {
        console.error(`\n${colors.red}Error:${colors.reset}`, error.message);
        console.error(error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
