const { ethers } = require("hardhat");

// Color codes
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

const ADDRESSES = {
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",

    TSLA_MARKET: "0x8ae559448a1482faffC925eF6a233276588348Df",
    USDTNGN_MARKET: "0x5E63276Caae0FF49b2762b98A1d37941AA50F804",
    USDTARS_MARKET: "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69",

    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827",
};

// DataStore base keys (from Keys.sol) - double-hash pattern
const BASE_KEYS = {
    POOL_AMOUNT: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])),
    OPEN_INTEREST: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])),
    OPEN_INTEREST_IN_TOKENS: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])),
    BORROWING_FACTOR: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["BORROWING_FACTOR"])),
    BORROWING_EXPONENT_FACTOR: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["BORROWING_EXPONENT_FACTOR"])),
    CUMULATIVE_BORROWING_FACTOR: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["CUMULATIVE_BORROWING_FACTOR"])),
    FUNDING_FACTOR: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["FUNDING_FACTOR"])),
    FUNDING_EXPONENT_FACTOR: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["FUNDING_EXPONENT_FACTOR"])),
    FUNDING_FEE_AMOUNT_PER_SIZE: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["FUNDING_FEE_AMOUNT_PER_SIZE"])),
    CLAIMABLE_FUNDING_AMOUNT_PER_SIZE: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["CLAIMABLE_FUNDING_AMOUNT_PER_SIZE"])),
};

// Key construction functions (matching Keys.sol pattern)
const KEYS = {
    POOL_AMOUNT: (market, token) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "address"], [BASE_KEYS.POOL_AMOUNT, market, token])),

    OPEN_INTEREST: (market, collateralToken, isLong) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "address", "bool"], [BASE_KEYS.OPEN_INTEREST, market, collateralToken, isLong])),

    OPEN_INTEREST_IN_TOKENS: (market, collateralToken, isLong) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "address", "bool"], [BASE_KEYS.OPEN_INTEREST_IN_TOKENS, market, collateralToken, isLong])),

    BORROWING_FACTOR: (market, isLong) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "bool"], [BASE_KEYS.BORROWING_FACTOR, market, isLong])),

    BORROWING_EXPONENT_FACTOR: (market, isLong) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "bool"], [BASE_KEYS.BORROWING_EXPONENT_FACTOR, market, isLong])),

    CUMULATIVE_BORROWING_FACTOR: (market, isLong) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "bool"], [BASE_KEYS.CUMULATIVE_BORROWING_FACTOR, market, isLong])),

    FUNDING_FACTOR: (market) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [BASE_KEYS.FUNDING_FACTOR, market])),

    FUNDING_EXPONENT_FACTOR: (market) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [BASE_KEYS.FUNDING_EXPONENT_FACTOR, market])),

    FUNDING_FEE_AMOUNT_PER_SIZE: (market, collateralToken, isLong) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "address", "bool"], [BASE_KEYS.FUNDING_FEE_AMOUNT_PER_SIZE, market, collateralToken, isLong])),

    CLAIMABLE_FUNDING_AMOUNT_PER_SIZE: (market, collateralToken, isLong) =>
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "address", "bool"], [BASE_KEYS.CLAIMABLE_FUNDING_AMOUNT_PER_SIZE, market, collateralToken, isLong])),
};

async function checkMarketConfig() {
    const [signer] = await ethers.getSigners();

    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    const markets = [
        {
            name: "TSLA",
            address: ADDRESSES.TSLA_MARKET,
            longToken: ADDRESSES.mUSD,
            shortToken: ADDRESSES.mUSD
        },
        {
            name: "USDTNGN",
            address: ADDRESSES.USDTNGN_MARKET,
            longToken: ADDRESSES.mUSD,
            shortToken: ADDRESSES.mNGN
        },
        {
            name: "USDTARS",
            address: ADDRESSES.USDTARS_MARKET,
            longToken: ADDRESSES.mUSD,
            shortToken: ADDRESSES.mUSD
        }
    ];

    console.log(`\n${colors.bright}=== Querying Market Configuration and State from DataStore ===${colors.reset}`);
    console.log(`DataStore: ${colors.cyan}${ADDRESSES.DATA_STORE}${colors.reset}\n`);

    for (const market of markets) {
        console.log(`${colors.bright}${"=".repeat(80)}${colors.reset}`);
        console.log(`${colors.bright}=== ${market.name} Market ===${colors.reset}`);
        console.log(`${colors.bright}${"=".repeat(80)}${colors.reset}`);
        console.log(`Market: ${colors.cyan}${market.address}${colors.reset}`);
        console.log(`Long Token: ${colors.yellow}${market.longToken}${colors.reset}`);
        console.log(`Short Token: ${colors.yellow}${market.shortToken}${colors.reset}\n`);

        try {
            // Pool amounts
            console.log(`${colors.bright}Pool Amounts:${colors.reset}`);
            const longPoolAmount = await dataStore.getUint(KEYS.POOL_AMOUNT(market.address, market.longToken));
            const shortPoolAmount = await dataStore.getUint(KEYS.POOL_AMOUNT(market.address, market.shortToken));
            console.log(`  Long Token Pool: ${colors.green}${ethers.utils.formatUnits(longPoolAmount, 6)} mUSD${colors.reset}`);
            if (market.shortToken === ADDRESSES.mUSD) {
                console.log(`  Short Token Pool: ${colors.green}${ethers.utils.formatUnits(shortPoolAmount, 6)} mUSD${colors.reset}`);
            } else {
                console.log(`  Short Token Pool: ${colors.green}${ethers.utils.formatUnits(shortPoolAmount, 18)} mNGN${colors.reset}`);
            }

            // Open Interest
            console.log(`\n${colors.bright}Open Interest (USD with 30 decimals):${colors.reset}`);
            const longOI = await dataStore.getUint(KEYS.OPEN_INTEREST(market.address, market.longToken, true));
            const shortOI = await dataStore.getUint(KEYS.OPEN_INTEREST(market.address, market.shortToken, false));
            console.log(`  Long OI: ${colors.green}$${ethers.utils.formatUnits(longOI, 30)}${colors.reset}`);
            console.log(`  Short OI: ${colors.red}$${ethers.utils.formatUnits(shortOI, 30)}${colors.reset}`);
            const totalOI = longOI.add(shortOI);
            console.log(`  Total OI: ${colors.cyan}$${ethers.utils.formatUnits(totalOI, 30)}${colors.reset}`);

            if (!totalOI.isZero()) {
                const longPercent = longOI.mul(10000).div(totalOI).toNumber() / 100;
                const shortPercent = shortOI.mul(10000).div(totalOI).toNumber() / 100;
                console.log(`  Long %: ${colors.green}${longPercent.toFixed(2)}%${colors.reset}`);
                console.log(`  Short %: ${colors.red}${shortPercent.toFixed(2)}%${colors.reset}`);
            }

            // Open Interest in Tokens
            console.log(`\n${colors.bright}Open Interest in Tokens:${colors.reset}`);
            const longOITokens = await dataStore.getUint(KEYS.OPEN_INTEREST_IN_TOKENS(market.address, market.longToken, true));
            const shortOITokens = await dataStore.getUint(KEYS.OPEN_INTEREST_IN_TOKENS(market.address, market.shortToken, false));
            console.log(`  Long OI in Tokens: ${ethers.utils.formatUnits(longOITokens, 18)} (18 decimals)`);
            console.log(`  Short OI in Tokens: ${ethers.utils.formatUnits(shortOITokens, 18)} (18 decimals)`);

            // Borrowing configuration
            console.log(`\n${colors.bright}Borrowing Configuration:${colors.reset}`);
            const borrowingFactorLong = await dataStore.getUint(KEYS.BORROWING_FACTOR(market.address, true));
            const borrowingFactorShort = await dataStore.getUint(KEYS.BORROWING_FACTOR(market.address, false));
            const borrowingExponentLong = await dataStore.getUint(KEYS.BORROWING_EXPONENT_FACTOR(market.address, true));
            const borrowingExponentShort = await dataStore.getUint(KEYS.BORROWING_EXPONENT_FACTOR(market.address, false));

            console.log(`  Borrowing Factor (Long): ${borrowingFactorLong.toString()}`);
            console.log(`  Borrowing Factor (Short): ${borrowingFactorShort.toString()}`);
            console.log(`  Borrowing Exponent (Long): ${borrowingExponentLong.toString()}`);
            console.log(`  Borrowing Exponent (Short): ${borrowingExponentShort.toString()}`);

            // Cumulative borrowing factor
            console.log(`\n${colors.bright}Cumulative Borrowing Factor (30 decimals):${colors.reset}`);
            const cumulativeBorrowingLong = await dataStore.getUint(KEYS.CUMULATIVE_BORROWING_FACTOR(market.address, true));
            const cumulativeBorrowingShort = await dataStore.getUint(KEYS.CUMULATIVE_BORROWING_FACTOR(market.address, false));
            console.log(`  Long: ${colors.yellow}${cumulativeBorrowingLong.toString()}${colors.reset} (${ethers.utils.formatUnits(cumulativeBorrowingLong, 30)})`);
            console.log(`  Short: ${colors.yellow}${cumulativeBorrowingShort.toString()}${colors.reset} (${ethers.utils.formatUnits(cumulativeBorrowingShort, 30)})`);

            // Funding configuration
            console.log(`\n${colors.bright}Funding Configuration:${colors.reset}`);
            const fundingFactor = await dataStore.getUint(KEYS.FUNDING_FACTOR(market.address));
            const fundingExponent = await dataStore.getUint(KEYS.FUNDING_EXPONENT_FACTOR(market.address));
            console.log(`  Funding Factor: ${fundingFactor.toString()}`);
            console.log(`  Funding Exponent: ${fundingExponent.toString()}`);

            // Funding fee per size
            console.log(`\n${colors.bright}Funding Fee Amount Per Size (30 decimals):${colors.reset}`);
            const fundingFeePerSizeLong = await dataStore.getUint(KEYS.FUNDING_FEE_AMOUNT_PER_SIZE(market.address, market.longToken, true));
            const fundingFeePerSizeShort = await dataStore.getUint(KEYS.FUNDING_FEE_AMOUNT_PER_SIZE(market.address, market.shortToken, false));
            console.log(`  Long: ${fundingFeePerSizeLong.toString()} (${ethers.utils.formatUnits(fundingFeePerSizeLong, 30)})`);
            console.log(`  Short: ${fundingFeePerSizeShort.toString()} (${ethers.utils.formatUnits(fundingFeePerSizeShort, 30)})`);

            // Claimable funding per size
            console.log(`\n${colors.bright}Claimable Funding Amount Per Size (30 decimals):${colors.reset}`);
            const claimableFundingLong = await dataStore.getUint(KEYS.CLAIMABLE_FUNDING_AMOUNT_PER_SIZE(market.address, market.longToken, true));
            const claimableFundingShort = await dataStore.getUint(KEYS.CLAIMABLE_FUNDING_AMOUNT_PER_SIZE(market.address, market.shortToken, false));
            console.log(`  Long: ${claimableFundingLong.toString()} (${ethers.utils.formatUnits(claimableFundingLong, 30)})`);
            console.log(`  Short: ${claimableFundingShort.toString()} (${ethers.utils.formatUnits(claimableFundingShort, 30)})`);

            console.log("");

        } catch (error) {
            console.error(`${colors.red}Error querying ${market.name}:${colors.reset}`, error.message);
        }
    }
}

async function main() {
    try {
        await checkMarketConfig();
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
