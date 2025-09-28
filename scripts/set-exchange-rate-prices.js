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
    MOCK_PROVIDER: "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5",
    USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
    sNGN: "0xd66e60AA5b6982649a116e6944Daec22b15468Ad"
};

async function setExchangeRatePrices(usdtRate, sngnRate) {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}=== Setting Exchange Rate Prices ===${colors.reset}`);
    console.log(`Signer: ${colors.cyan}${signer.address}${colors.reset}`);

    // Get MockOracleProvider contract
    const mockProvider = await ethers.getContractAt(
        ["function setPriceWithPrecision(address token, uint256 price) external"],
        ADDRESSES.MOCK_PROVIDER
    );

    // Calculate prices with proper precision
    // Both tokens need precision 30 for the price values
    // USDT has 6 decimals, so we need 30 - 6 = 24 additional decimals
    // sNGN has 18 decimals, so we need 30 - 18 = 12 additional decimals

    const usdtPriceWithPrecision = ethers.utils.parseUnits(usdtRate.toString(), 24);
    const sngnPriceWithPrecision = ethers.utils.parseUnits(sngnRate.toString(), 12);

    console.log(`\n${colors.bright}New Exchange Rate Configuration:${colors.reset}`);
    console.log(`  1 USDT = ${colors.green}${usdtRate} NGN${colors.reset}`);
    console.log(`  1 sNGN = ${colors.green}${sngnRate} NGN${colors.reset}`);
    console.log(`  Exchange Rate: ${colors.magenta}1 USDT = ${usdtRate/sngnRate} sNGN${colors.reset}`);

    console.log(`\n${colors.bright}Raw Values (with precision):${colors.reset}`);
    console.log(`  USDT: ${usdtPriceWithPrecision.toString()}`);
    console.log(`  sNGN: ${sngnPriceWithPrecision.toString()}`);

    try {
        // Set USDT price
        console.log(`\n${colors.yellow}Setting USDT price...${colors.reset}`);
        const tx1 = await mockProvider.setPriceWithPrecision(
            ADDRESSES.USDT,
            usdtPriceWithPrecision
        );
        console.log(`  Transaction: ${colors.cyan}${tx1.hash}${colors.reset}`);
        await tx1.wait();
        console.log(`  ${colors.green}✅ USDT price updated${colors.reset}`);

        // Set sNGN price
        console.log(`\n${colors.yellow}Setting sNGN price...${colors.reset}`);
        const tx2 = await mockProvider.setPriceWithPrecision(
            ADDRESSES.sNGN,
            sngnPriceWithPrecision
        );
        console.log(`  Transaction: ${colors.cyan}${tx2.hash}${colors.reset}`);
        await tx2.wait();
        console.log(`  ${colors.green}✅ sNGN price updated${colors.reset}`);

        console.log(`\n${colors.green}${colors.bright}✅ Exchange rate prices successfully updated!${colors.reset}`);
        console.log(`\n${colors.bright}Price Summary:${colors.reset}`);
        console.log(`  USDT/NGN Rate: ${colors.green}1:${usdtRate}${colors.reset}`);
        console.log(`  sNGN/NGN Rate: ${colors.green}1:${sngnRate}${colors.reset}`);

        // Show example scenarios
        console.log(`\n${colors.bright}Position Impact Examples:${colors.reset}`);
        console.log(`  ${colors.cyan}Long Position:${colors.reset}`);
        console.log(`    • Profits if USDT rate increases (e.g., 1500 → 1600)`);
        console.log(`    • Loses if USDT rate decreases (e.g., 1500 → 1400)`);
        console.log(`  ${colors.cyan}Short Position:${colors.reset}`);
        console.log(`    • Profits if USDT rate decreases (e.g., 1500 → 1400)`);
        console.log(`    • Loses if USDT rate increases (e.g., 1500 → 1600)`);

    } catch (error) {
        console.log(`\n${colors.red}Error setting prices:${colors.reset} ${error.message}`);
        throw error;
    }
}

async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);

    let usdtRate = 1500; // Default: 1 USDT = 1500 NGN
    let sngnRate = 1;    // Default: 1 sNGN = 1 NGN

    // Check for custom rates
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--usdt' && i + 1 < args.length) {
            usdtRate = parseFloat(args[i + 1]);
        }
        if (args[i] === '--sngn' && i + 1 < args.length) {
            sngnRate = parseFloat(args[i + 1]);
        }
        if (args[i] === '--help') {
            console.log(`
${colors.bright}USAGE:${colors.reset}
  npx hardhat run scripts/set-exchange-rate-prices.js --network arbitrumSepolia [OPTIONS]

${colors.bright}OPTIONS:${colors.reset}
  --usdt <rate>   Set USDT/NGN exchange rate (default: 1500)
  --sngn <rate>   Set sNGN/NGN rate (default: 1)
  --help          Show this help message

${colors.bright}EXAMPLES:${colors.reset}
  # Set default rates (1 USDT = 1500 NGN, 1 sNGN = 1 NGN)
  npx hardhat run scripts/set-exchange-rate-prices.js --network arbitrumSepolia

  # Set USDT to appreciate (1 USDT = 1600 NGN)
  npx hardhat run scripts/set-exchange-rate-prices.js --network arbitrumSepolia --usdt 1600

  # Set USDT to depreciate (1 USDT = 1400 NGN)
  npx hardhat run scripts/set-exchange-rate-prices.js --network arbitrumSepolia --usdt 1400

  # Set both rates
  npx hardhat run scripts/set-exchange-rate-prices.js --network arbitrumSepolia --usdt 1550 --sngn 1

${colors.bright}NOTES:${colors.reset}
  • USDT is the index token in your market
  • Position PnL is calculated based on USDT price movement
  • Long positions profit when USDT appreciates (rate increases)
  • Short positions profit when USDT depreciates (rate decreases)
`);
            process.exit(0);
        }
    }

    // Validate inputs
    if (isNaN(usdtRate) || usdtRate <= 0) {
        console.log(`${colors.red}Error: Invalid USDT rate${colors.reset}`);
        process.exit(1);
    }
    if (isNaN(sngnRate) || sngnRate <= 0) {
        console.log(`${colors.red}Error: Invalid sNGN rate${colors.reset}`);
        process.exit(1);
    }

    await setExchangeRatePrices(usdtRate, sngnRate);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });