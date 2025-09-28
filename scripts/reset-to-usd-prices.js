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

async function resetToUsdPrices() {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}=== Resetting to Original USD Pricing ===${colors.reset}`);
    console.log(`Signer: ${colors.cyan}${signer.address}${colors.reset}`);

    // Get MockOracleProvider contract
    const mockProvider = await ethers.getContractAt(
        ["function setPriceWithPrecision(address token, uint256 price) external"],
        ADDRESSES.MOCK_PROVIDER
    );

    // Original USD pricing
    // USDT: $1.00 USD
    // sNGN: $0.000666667 USD (1/1500)

    // Calculate prices with proper precision
    // USDT has 6 decimals, needs precision 30, so 30 - 6 = 24 additional decimals
    const usdtPriceUSD = ethers.utils.parseUnits("1", 24); // $1.00

    // sNGN has 18 decimals, needs precision 30, so 30 - 18 = 12 additional decimals
    // For 1/1500 = 0.000666667, we calculate: 10^12 / 1500
    const sngnPriceUSD = ethers.BigNumber.from(10).pow(12).div(1500); // $0.000666667

    console.log(`\n${colors.bright}Original USD Pricing Configuration:${colors.reset}`);
    console.log(`  1 USDT = ${colors.green}$1.00 USD${colors.reset}`);
    console.log(`  1 sNGN = ${colors.green}$0.000666667 USD (1/1500)${colors.reset}`);
    console.log(`  Exchange Rate: ${colors.magenta}1 USD = 1500 sNGN${colors.reset}`);

    console.log(`\n${colors.bright}Raw Values (with precision):${colors.reset}`);
    console.log(`  USDT: ${usdtPriceUSD.toString()} (10^24)`);
    console.log(`  sNGN: ${sngnPriceUSD.toString()} (10^12 / 1500)`);

    try {
        // Set USDT price
        console.log(`\n${colors.yellow}Setting USDT price to $1.00...${colors.reset}`);
        const tx1 = await mockProvider.setPriceWithPrecision(
            ADDRESSES.USDT,
            usdtPriceUSD
        );
        console.log(`  Transaction: ${colors.cyan}${tx1.hash}${colors.reset}`);
        await tx1.wait();
        console.log(`  ${colors.green}✅ USDT price updated to $1.00${colors.reset}`);

        // Set sNGN price
        console.log(`\n${colors.yellow}Setting sNGN price to $0.000666667...${colors.reset}`);
        const tx2 = await mockProvider.setPriceWithPrecision(
            ADDRESSES.sNGN,
            sngnPriceUSD
        );
        console.log(`  Transaction: ${colors.cyan}${tx2.hash}${colors.reset}`);
        await tx2.wait();
        console.log(`  ${colors.green}✅ sNGN price updated to $1/1500${colors.reset}`);

        console.log(`\n${colors.green}${colors.bright}✅ Successfully reset to USD pricing!${colors.reset}`);
        console.log(`\n${colors.bright}Price Summary:${colors.reset}`);
        console.log(`  USDT: ${colors.green}$1.00 USD${colors.reset}`);
        console.log(`  sNGN: ${colors.green}$0.000666667 USD${colors.reset}`);
        console.log(`  Rate: ${colors.green}1500 sNGN per USD${colors.reset}`);

        console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
        console.log(`  1. ${colors.yellow}Update the keeper to use USD pricing${colors.reset}`);
        console.log(`  2. ${colors.yellow}Close all existing positions${colors.reset}`);
        console.log(`  3. ${colors.yellow}Withdraw all liquidity${colors.reset}`);
        console.log(`  4. ${colors.yellow}Re-add liquidity with NGN pricing active${colors.reset}`);

        console.log(`\n${colors.red}${colors.bright}⚠️  IMPORTANT:${colors.reset}`);
        console.log(`  Make sure to update order_keeper_v2.py to use USD prices before restarting!`);
        console.log(`  USDT: 10**24 (for $1.00)`);
        console.log(`  sNGN: 10**12 // 1500 (for $1/1500)`);

    } catch (error) {
        console.log(`\n${colors.red}Error setting prices:${colors.reset} ${error.message}`);
        throw error;
    }
}

async function main() {
    await resetToUsdPrices();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });