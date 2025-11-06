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
    REFERRAL_STORAGE: "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547",

    // Markets
    TSLA_MARKET: "0x8ae559448a1482faffC925eF6a233276588348Df",  // Market 11: mTSLA [mUSD-mUSD]
    USDTNGN_MARKET: "0x5E63276Caae0FF49b2762b98A1d37941AA50F804",  // Market 9: mUSDTNGN [mUSD-mNGN]
    USDTARS_MARKET: "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69",  // Market 12: mUSDTARS [mUSD-mUSD]
    NVDA_MARKET: "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C",  // Market 13: mNVDA [mUSD-mUSD]

    // Tokens
    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",  // 6 decimals
    mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827",  // 18 decimals
    mTSLA: "0x77d4DdD2E847592fb7710e342C0492A4b85655f4",  // 18 decimals
    mUSDTARS: "0xed6890bE2409F0db06a00C809a298E2E06553BE1",  // 18 decimals
    mNVDA: "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325",  // 18 decimals
};

const CURRENT_PRICE = 407.0;  // TSLA current price

async function checkPositionFees() {
    const [signer] = await ethers.getSigners();

    const ACCOUNT = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";  // Your wallet

    console.log(`\n${colors.bright}=== Checking Position Fees from Reader ===${colors.reset}`);
    console.log(`Account: ${colors.cyan}${ACCOUNT}${colors.reset}`);
    console.log(`Reader: ${colors.cyan}${ADDRESSES.READER}${colors.reset}`);

    // Check when funding was last updated
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const BASE_FUNDING_KEY = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["FUNDING_UPDATED_AT"]));
    const block = await ethers.provider.getBlock("latest");

    console.log(`\n${colors.bright}=== Funding Update Status ===${colors.reset}`);
    console.log(`Current Time: ${colors.cyan}${new Date(block.timestamp * 1000).toISOString()}${colors.reset}`);

    for (const [name, address] of [["TSLA", ADDRESSES.TSLA_MARKET], ["USDTNGN", ADDRESSES.USDTNGN_MARKET], ["USDTARS", ADDRESSES.USDTARS_MARKET]]) {
        const key = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [BASE_FUNDING_KEY, address]));
        const fundingUpdatedAt = await dataStore.getUint(key);
        const hoursSince = (block.timestamp - fundingUpdatedAt.toNumber()) / 3600;

        console.log(`${colors.yellow}${name}:${colors.reset} Last updated ${hoursSince.toFixed(2)} hours ago (${new Date(fundingUpdatedAt.toNumber() * 1000).toISOString()})`);
    }
    console.log("");

    // Get Reader contract
    const reader = await ethers.getContractAt("Reader", ADDRESSES.READER);

    // Define all markets to check
    const allMarkets = [
        ADDRESSES.TSLA_MARKET,
        ADDRESSES.USDTNGN_MARKET,
        ADDRESSES.USDTARS_MARKET,
        ADDRESSES.NVDA_MARKET
    ];

    // Create price data for all markets
    // For TSLA price format: use current price directly with 12 decimals precision
    const marketPrices = [
        // TSLA market (index 0) - SINGLE TOKEN MARKET (mUSD/mUSD)
        {
            indexTokenPrice: {
                min: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 12),  // TSLA price
                max: ethers.utils.parseUnits(CURRENT_PRICE.toString(), 12)
            },
            longTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),  // mUSD = $1
                max: ethers.utils.parseUnits("1", 24)
            },
            shortTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),  // mUSD = $1 (same as long token!)
                max: ethers.utils.parseUnits("1", 24)
            }
        },
        // USDTNGN market (index 1)
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
        // USDTARS market (index 2) - SINGLE TOKEN MARKET (mUSD/mUSD)
        {
            indexTokenPrice: {
                min: ethers.utils.parseUnits("1000", 12),
                max: ethers.utils.parseUnits("1000", 12)
            },
            longTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),  // mUSD = $1
                max: ethers.utils.parseUnits("1", 24)
            },
            shortTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),  // mUSD = $1 (same as long token!)
                max: ethers.utils.parseUnits("1", 24)
            }
        },
        // NVDA market (index 3) - SINGLE TOKEN MARKET (mUSD/mUSD)
        {
            indexTokenPrice: {
                min: ethers.utils.parseUnits("140", 12),
                max: ethers.utils.parseUnits("140", 12)
            },
            longTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),  // mUSD = $1
                max: ethers.utils.parseUnits("1", 24)
            },
            shortTokenPrice: {
                min: ethers.utils.parseUnits("1", 24),  // mUSD = $1 (same as long token!)
                max: ethers.utils.parseUnits("1", 24)
            }
        }
    ];

    console.log(`\n${colors.bright}Calling getAccountPositionInfoList...${colors.reset}`);

    try {
        const positionInfoList = await reader.getAccountPositionInfoList(
            ADDRESSES.DATA_STORE,
            ADDRESSES.REFERRAL_STORAGE,
            ACCOUNT,
            allMarkets,
            marketPrices,
            ethers.constants.AddressZero,  // uiFeeReceiver
            0,  // start
            1000  // end
        );

        console.log(`${colors.green}Found ${positionInfoList.length} positions${colors.reset}\n`);

        for (let i = 0; i < positionInfoList.length; i++) {
            const positionInfo = positionInfoList[i];
            const { position, fees, basePnlUsd } = positionInfo;
            const { addresses, numbers, flags } = position;

            // Determine market name
            let marketName = "UNKNOWN";
            if (addresses.market.toLowerCase() === ADDRESSES.TSLA_MARKET.toLowerCase()) {
                marketName = "TSLA";
            } else if (addresses.market.toLowerCase() === ADDRESSES.USDTNGN_MARKET.toLowerCase()) {
                marketName = "USDTNGN";
            } else if (addresses.market.toLowerCase() === ADDRESSES.USDTARS_MARKET.toLowerCase()) {
                marketName = "USDTARS";
            } else if (addresses.market.toLowerCase() === ADDRESSES.NVDA_MARKET.toLowerCase()) {
                marketName = "NVDA";
            }

            console.log(`${colors.bright}=== Position ${i + 1}: ${marketName} ${flags.isLong ? 'LONG' : 'SHORT'} ===${colors.reset}`);
            console.log(`Market: ${colors.cyan}${addresses.market}${colors.reset}`);
            console.log(`Collateral Token: ${colors.yellow}${addresses.collateralToken}${colors.reset}`);

            const positionAge = block.timestamp - numbers.increasedAtTime.toNumber();
            console.log(`Position Opened: ${colors.magenta}${new Date(numbers.increasedAtTime.toNumber() * 1000).toISOString()}${colors.reset}`);
            console.log(`Position Age: ${colors.magenta}${(positionAge / 3600).toFixed(2)} hours (${(positionAge / 86400).toFixed(2)} days)${colors.reset}`);

            // Position size and collateral
            console.log(`\n${colors.bright}Position Details:${colors.reset}`);
            console.log(`  Size in USD (30 decimals): ${colors.green}$${ethers.utils.formatUnits(numbers.sizeInUsd, 30)}${colors.reset}`);
            console.log(`  Size in Tokens (18 decimals): ${ethers.utils.formatUnits(numbers.sizeInTokens, 18)}`);

            // Detect collateral token decimals
            let collateralDecimals = 6;  // Default to mUSD
            if (addresses.collateralToken.toLowerCase() === ADDRESSES.mNGN.toLowerCase()) {
                collateralDecimals = 18;
            }
            console.log(`  Collateral Amount (${collateralDecimals} decimals): ${colors.yellow}${ethers.utils.formatUnits(numbers.collateralAmount, collateralDecimals)}${colors.reset}`);

            // Calculate entry price
            const sizeUsd = parseFloat(ethers.utils.formatUnits(numbers.sizeInUsd, 30));
            const sizeTokens = parseFloat(ethers.utils.formatUnits(numbers.sizeInTokens, 18));
            const entryPrice = sizeTokens > 0 ? sizeUsd / sizeTokens : 0;
            console.log(`  Entry Price: ${colors.magenta}$${entryPrice.toFixed(2)}${colors.reset}`);

            // FEES - THIS IS THE IMPORTANT PART
            console.log(`\n${colors.bright}=== RAW FEE VALUES FROM READER ===${colors.reset}`);
            console.log(`\n${colors.bright}Position Numbers (for borrowing calculation):${colors.reset}`);
            console.log(`  Position borrowingFactor (stored): ${colors.yellow}${numbers.borrowingFactor.toString()}${colors.reset}`);
            console.log(`  Position borrowingFactor (30 decimals): ${ethers.utils.formatUnits(numbers.borrowingFactor, 30)}`);
            console.log(`  Position fundingFeeAmountPerSize (stored): ${colors.yellow}${numbers.fundingFeeAmountPerSize.toString()}${colors.reset}`);
            console.log(`  Position fundingFeeAmountPerSize (30 decimals): ${ethers.utils.formatUnits(numbers.fundingFeeAmountPerSize, 30)}`);

            // Borrowing fee
            console.log(`\n${colors.yellow}Borrowing Fee:${colors.reset}`);
            console.log(`  borrowingFeeUsd (RAW): ${fees.borrowing.borrowingFeeUsd.toString()}`);
            console.log(`  borrowingFeeUsd (30 decimals): ${colors.red}$${ethers.utils.formatUnits(fees.borrowing.borrowingFeeUsd, 30)}${colors.reset}`);

            // Funding fee
            console.log(`\n${colors.yellow}Funding Fee:${colors.reset}`);
            console.log(`  fundingFeeAmount (RAW): ${fees.funding.fundingFeeAmount.toString()}`);
            console.log(`  fundingFeeAmount (30 decimals): ${colors.green}$${ethers.utils.formatUnits(fees.funding.fundingFeeAmount, 30)}${colors.reset}`);
            console.log(`\n${colors.yellow}Latest Market Funding Per Size:${colors.reset}`);
            console.log(`  latestFundingFeeAmountPerSize (RAW): ${fees.funding.latestFundingFeeAmountPerSize.toString()}`);
            console.log(`  latestFundingFeeAmountPerSize (30 decimals): ${ethers.utils.formatUnits(fees.funding.latestFundingFeeAmountPerSize, 30)}`);

            // Claimable amounts
            console.log(`\n${colors.yellow}Claimable Funding:${colors.reset}`);
            console.log(`  claimableLongTokenAmount (RAW): ${fees.funding.claimableLongTokenAmount.toString()}`);
            console.log(`  claimableLongTokenAmount (6 decimals - mUSD): $${ethers.utils.formatUnits(fees.funding.claimableLongTokenAmount, 6)}`);
            console.log(`  claimableShortTokenAmount (RAW): ${fees.funding.claimableShortTokenAmount.toString()}`);
            console.log(`  claimableShortTokenAmount (6 decimals - mUSD): $${ethers.utils.formatUnits(fees.funding.claimableShortTokenAmount, 6)}`);

            // Total fees
            console.log(`\n${colors.yellow}Total Fees:${colors.reset}`);
            console.log(`  totalCostAmount (RAW): ${fees.totalCostAmount.toString()}`);
            console.log(`  totalCostAmount (30 decimals): ${colors.cyan}$${ethers.utils.formatUnits(fees.totalCostAmount, 30)}${colors.reset}`);

            // Position fee
            console.log(`  positionFeeAmount (RAW): ${fees.positionFeeAmount.toString()}`);
            console.log(`  positionFeeAmount (${collateralDecimals} decimals): $${ethers.utils.formatUnits(fees.positionFeeAmount, collateralDecimals)}`);

            console.log(`\n${colors.bright}=== FEE CALCULATION SUMMARY ===${colors.reset}`);
            const borrowingFee = parseFloat(ethers.utils.formatUnits(fees.borrowing.borrowingFeeUsd, 30));
            const fundingFee = parseFloat(ethers.utils.formatUnits(fees.funding.fundingFeeAmount, 30));
            const totalFee = parseFloat(ethers.utils.formatUnits(fees.totalCostAmount, 30));

            console.log(`  Borrowing Fee (USD): ${colors.red}$${borrowingFee.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 6})}${colors.reset}`);
            console.log(`  Funding Fee (USD): ${colors.yellow}$${fundingFee.toFixed(6)}${colors.reset}`);
            console.log(`  Total Fees (USD): ${colors.cyan}$${totalFee.toFixed(2)}${colors.reset}`);

            if (borrowingFee > 1000000) {
                console.log(`  ${colors.red}⚠️  WARNING: Borrowing fee is abnormally high (>${borrowingFee.toExponential(2)})${colors.reset}`);
            }

            console.log(`\n${"=".repeat(80)}\n`);
        }

        if (positionInfoList.length === 0) {
            console.log(`${colors.yellow}No open positions found for this account${colors.reset}`);
        }

    } catch (error) {
        console.error(`${colors.red}Error calling Reader:${colors.reset}`, error.message);
        console.error(error);
    }
}

async function main() {
    try {
        await checkPositionFees();
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
