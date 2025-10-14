const { ethers } = require("hardhat");

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Contract addresses
const ADDRESSES = {
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",
    REFERRAL_STORAGE: "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547",
    MARKET: "0x5E63276Caae0FF49b2762b98A1d37941AA50F804",  // Market 9: mUSDTNGN/mUSD/mNGN
    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827"
};

// Account to check
const ACCOUNT = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";

async function testGetAccountPositionInfoList() {
    console.log(`\n${colors.bright}=== Testing getAccountPositionInfoList ===${colors.reset}`);
    console.log(`Account: ${colors.cyan}${ACCOUNT}${colors.reset}`);
    console.log(`Market: ${colors.cyan}${ADDRESSES.MARKET}${colors.reset}\n`);

    // Get Reader contract
    const reader = await ethers.getContractAt("Reader", ADDRESSES.READER);

    // Simulate current market price (e.g., 1476.75 NGN/USD)
    const CURRENT_PRICE = 1476.75;

    // Build price payload exactly like frontend does
    const indexTokenPrice = CURRENT_PRICE; // e.g., 1476.75
    const longTokenPrice = 1; // USDT = $1
    const shortTokenPrice = 1 / CURRENT_PRICE; // e.g., 0.000677

    // Format prices for contract (matching frontend logic)
    const indexStr = indexTokenPrice.toString();
    const shortStr = shortTokenPrice.toFixed(12);

    // Convert to contract format
    // indexToken (mNGN, 18 decimals): price with 12 decimals precision
    // longToken (mUSD, 6 decimals): price with 24 decimals precision
    // shortToken (mNGN, 18 decimals): price with 12 decimals precision
    const formattedIndexPrice = ethers.utils.parseUnits(indexStr, 12);
    const formattedLongPrice = ethers.utils.parseUnits("1", 24);
    const formattedShortPrice = ethers.utils.parseUnits(shortStr, 12);

    console.log(`${colors.bright}Price Payload:${colors.reset}`);
    console.log(`  Index Token Price (${indexStr}): ${colors.yellow}${formattedIndexPrice.toString()}${colors.reset}`);
    console.log(`  Long Token Price (1): ${colors.yellow}${formattedLongPrice.toString()}${colors.reset}`);
    console.log(`  Short Token Price (${shortStr}): ${colors.yellow}${formattedShortPrice.toString()}${colors.reset}\n`);

    // Build arrays exactly like frontend
    const marketsArray = [ADDRESSES.MARKET];
    const pricesArray = [{
        indexTokenPrice: { min: formattedIndexPrice, max: formattedIndexPrice },
        longTokenPrice: { min: formattedLongPrice, max: formattedLongPrice },
        shortTokenPrice: { min: formattedShortPrice, max: formattedShortPrice }
    }];

    console.log(`${colors.bright}Calling getAccountPositionInfoList...${colors.reset}`);
    console.log(`  Markets array length: ${marketsArray.length}`);
    console.log(`  Prices array length: ${pricesArray.length}\n`);

    try {
        // Call exactly like frontend does
        const result = await reader.getAccountPositionInfoList(
            ADDRESSES.DATA_STORE,
            ADDRESSES.REFERRAL_STORAGE,
            ACCOUNT,
            marketsArray,
            pricesArray,
            ethers.constants.AddressZero, // uiFeeReceiver
            0, // start
            1000 // limit
        );

        console.log(`${colors.green}SUCCESS!${colors.reset} Contract returned ${result.length} entries\n`);

        // Log each position
        result.forEach((positionInfo, index) => {
            const { position, fees, basePnlUsd, positionKey } = positionInfo;
            const { addresses, numbers, flags } = position;

            console.log(`${colors.bright}Position ${index}:${colors.reset}`);
            console.log(`  Position Key: ${colors.magenta}${positionKey}${colors.reset}`);
            console.log(`  Market: ${addresses.market}`);
            console.log(`  Collateral Token: ${addresses.collateralToken}`);
            console.log(`  Is Long: ${flags.isLong}`);
            console.log(`  Size in USD: ${ethers.utils.formatUnits(numbers.sizeInUsd, 30)}`);
            console.log(`  Collateral Amount: ${ethers.utils.formatUnits(numbers.collateralAmount, 6)} mUSD`);
            console.log(`  Increased At Time: ${numbers.increasedAtTime.toString()}`);
            console.log(`  Base PnL USD: ${ethers.utils.formatUnits(basePnlUsd, 30)}`);

            // Check if this is a valid position
            const isValid = numbers.increasedAtTime.gt(0) && numbers.sizeInUsd.gt(0);
            console.log(`  ${isValid ? colors.green + '✓ Valid Position' : colors.red + '✗ Invalid/Empty Position'}${colors.reset}\n`);
        });

        // Summary
        const validPositions = result.filter(p =>
            p.position.numbers.increasedAtTime.gt(0) &&
            p.position.numbers.sizeInUsd.gt(0)
        );

        console.log(`${colors.bright}Summary:${colors.reset}`);
        console.log(`  Total entries returned: ${result.length}`);
        console.log(`  Valid positions: ${colors.green}${validPositions.length}${colors.reset}`);
        console.log(`  Invalid/empty entries: ${colors.yellow}${result.length - validPositions.length}${colors.reset}`);

    } catch (error) {
        console.log(`${colors.red}ERROR calling getAccountPositionInfoList:${colors.reset}`);
        console.error(error.message);
        if (error.reason) {
            console.error('Reason:', error.reason);
        }
    }
}

async function main() {
    try {
        await testGetAccountPositionInfoList();
    } catch (error) {
        console.log(`\n${colors.red}Error:${colors.reset} ${error.message}`);
        console.error(error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
