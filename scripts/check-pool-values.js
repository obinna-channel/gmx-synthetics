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
    MARKET: "0x8E4C5f3296A100d4135187C3181258cb8a223bb1",
    USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
    sNGN: "0xd66e60AA5b6982649a116e6944Daec22b15468Ad",
    MOCK_PROVIDER: "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5"
};

async function checkPoolValues() {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}=== Market Pool Analysis ===${colors.reset}`);
    console.log(`Market: ${colors.cyan}${ADDRESSES.MARKET}${colors.reset}`);

    // Get DataStore contract
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    // Get Oracle/MockProvider for prices
    const mockProvider = await ethers.getContractAt(
        [
            {
                "inputs": [{"name": "token", "type": "address"}],
                "name": "prices",
                "outputs": [
                    {"name": "min", "type": "uint256"},
                    {"name": "max", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ],
        ADDRESSES.MOCK_PROVIDER
    );

    // Helper function to get pool amount
    async function getPoolAmount(token) {
        // The correct key structure for pool amounts:
        // keccak256(abi.encode(keccak256(abi.encode("POOL_AMOUNT")), market, token))
        const POOL_AMOUNT_HASH = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
        );

        const key = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [POOL_AMOUNT_HASH, ADDRESSES.MARKET, token]
            )
        );

        return await dataStore.getUint(key);
    }

    // Get pool amounts
    const usdtPoolAmount = await getPoolAmount(ADDRESSES.USDT);
    const sngnPoolAmount = await getPoolAmount(ADDRESSES.sNGN);

    console.log(`\n${colors.bright}Pool Token Amounts:${colors.reset}`);
    console.log(`  USDT Pool: ${colors.green}${ethers.utils.formatUnits(usdtPoolAmount, 6)} USDT${colors.reset}`);
    console.log(`  sNGN Pool: ${colors.green}${ethers.utils.formatUnits(sngnPoolAmount, 18)} sNGN${colors.reset}`);

    // Get current oracle prices
    const usdtPrice = await mockProvider.prices(ADDRESSES.USDT);
    const sngnPrice = await mockProvider.prices(ADDRESSES.sNGN);

    console.log(`\n${colors.bright}Oracle Prices (Raw):${colors.reset}`);
    console.log(`  USDT: ${usdtPrice.min.toString()}`);
    console.log(`  sNGN: ${sngnPrice.min.toString()}`);

    // Calculate human-readable prices (assuming precision 30)
    // USDT has 6 decimals, so precision adjustment is 10^24
    // sNGN has 18 decimals, so precision adjustment is 10^12
    const usdtRate = usdtPrice.min.div(ethers.BigNumber.from(10).pow(24));
    const sngnRate = sngnPrice.min.div(ethers.BigNumber.from(10).pow(12));

    console.log(`\n${colors.bright}Exchange Rates:${colors.reset}`);
    console.log(`  1 USDT = ${colors.yellow}${usdtRate.toString()} NGN${colors.reset}`);
    console.log(`  1 sNGN = ${colors.yellow}${sngnRate.toString()} NGN${colors.reset}`);

    // Calculate pool values
    // Pool value in NGN terms
    const usdtPoolValueNGN = usdtPoolAmount.mul(usdtPrice.min).div(ethers.BigNumber.from(10).pow(6));
    const sngnPoolValueNGN = sngnPoolAmount.mul(sngnPrice.min).div(ethers.BigNumber.from(10).pow(18));

    console.log(`\n${colors.bright}Pool Values (in precision 30):${colors.reset}`);
    console.log(`  USDT Pool Value: ${usdtPoolValueNGN.toString()}`);
    console.log(`  sNGN Pool Value: ${sngnPoolValueNGN.toString()}`);
    console.log(`  Total Pool Value: ${usdtPoolValueNGN.add(sngnPoolValueNGN).toString()}`);

    // Display in human-readable format
    const usdtPoolValueHuman = ethers.utils.formatUnits(usdtPoolValueNGN, 30);
    const sngnPoolValueHuman = ethers.utils.formatUnits(sngnPoolValueNGN, 30);
    const totalPoolValueHuman = ethers.utils.formatUnits(usdtPoolValueNGN.add(sngnPoolValueNGN), 30);

    console.log(`\n${colors.bright}Pool Values (Human Readable):${colors.reset}`);
    console.log(`  USDT Pool: ${colors.magenta}${parseFloat(usdtPoolValueHuman).toFixed(2)}${colors.reset}`);
    console.log(`  sNGN Pool: ${colors.magenta}${parseFloat(sngnPoolValueHuman).toFixed(2)}${colors.reset}`);
    console.log(`  Total Value: ${colors.magenta}${parseFloat(totalPoolValueHuman).toFixed(2)}${colors.reset}`);

    // Check open interest
    async function getOpenInterest(isLong) {
        const openInterestKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])),
                    ADDRESSES.MARKET,
                    ADDRESSES.USDT,
                    isLong
                ]
            )
        );
        return await dataStore.getUint(openInterestKey);
    }

    const longOpenInterest = await getOpenInterest(true);
    const shortOpenInterest = await getOpenInterest(false);

    console.log(`\n${colors.bright}Open Interest:${colors.reset}`);
    console.log(`  Long: ${colors.cyan}$${ethers.utils.formatUnits(longOpenInterest, 30)}${colors.reset}`);
    console.log(`  Short: ${colors.cyan}$${ethers.utils.formatUnits(shortOpenInterest, 30)}${colors.reset}`);

    // Check impact pool amounts
    async function getImpactPoolAmount() {
        // The correct key structure: keccak256(abi.encode(keccak256("IMPACT_POOL_AMOUNT"), market))
        const IMPACT_POOL_AMOUNT_HASH = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["IMPACT_POOL_AMOUNT"])
        );

        const key = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [IMPACT_POOL_AMOUNT_HASH, ADDRESSES.MARKET]
            )
        );
        return await dataStore.getUint(key);
    }

    const impactPoolAmount = await getImpactPoolAmount();
    console.log(`\n${colors.bright}Impact Pool:${colors.reset}`);
    console.log(`  Amount: ${colors.yellow}${ethers.utils.formatUnits(impactPoolAmount, 6)} USDT${colors.reset}`);

    // Analysis
    console.log(`\n${colors.bright}=== Analysis ===${colors.reset}`);

    // Check if pool values suggest USD vs NGN mismatch
    if (usdtRate.gt(100)) {
        console.log(`${colors.green}✓ USDT price appears to be in NGN terms (${usdtRate.toString()} NGN)${colors.reset}`);
    } else {
        console.log(`${colors.red}✗ USDT price appears to be in USD terms (${usdtRate.toString()})${colors.reset}`);
    }

    // Check pool value scale
    const poolValueScale = parseFloat(totalPoolValueHuman);
    if (poolValueScale > 1000) {
        console.log(`${colors.yellow}⚠ Pool values appear to be in NGN scale${colors.reset}`);
        console.log(`  This might explain PnL calculation issues if positions expect USD scale`);
    } else if (poolValueScale < 1) {
        console.log(`${colors.yellow}⚠ Pool values appear very small${colors.reset}`);
        console.log(`  This might indicate a unit mismatch`);
    }

    // Calculate what pool values would be in USD terms
    if (usdtRate.gt(0) && sngnRate.gt(0)) {
        const usdtPoolUSD = usdtPoolAmount.mul(10**6).div(usdtRate).div(10**6);
        const sngnPoolUSD = sngnPoolAmount.mul(10**12).div(sngnRate).div(10**18);

        console.log(`\n${colors.bright}Pool Values if converted to USD:${colors.reset}`);
        console.log(`  USDT Pool: ~${colors.green}$${ethers.utils.formatUnits(usdtPoolUSD, 6)}${colors.reset}`);
        console.log(`  sNGN Pool: ~${colors.green}$${ethers.utils.formatUnits(sngnPoolUSD, 6)}${colors.reset}`);
    }
}

async function main() {
    try {
        await checkPoolValues();
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