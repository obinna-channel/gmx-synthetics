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

// Contract addresses for Market #7
const ADDRESSES = {
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",
    MARKET: "0xf7F4Bb2014A164A919Ccec2b97Bd4805f86B83aD",  // Market 7: mUSD/mUSD/mNGN
    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827",
    MOCK_PROVIDER: "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5"
};

async function checkPoolValue() {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}=== Market #7 Pool Value Analysis ===${colors.reset}`);
    console.log(`Market: ${colors.cyan}${ADDRESSES.MARKET}${colors.reset}`);
    console.log(`Type: ${colors.yellow}mUSD/mUSD/mNGN${colors.reset}\n`);

    // Get contracts
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const reader = await ethers.getContractAt("Reader", ADDRESSES.READER);
    const marketToken = await ethers.getContractAt("MarketToken", ADDRESSES.MARKET);
    const musdToken = await ethers.getContractAt("IERC20", ADDRESSES.mUSD);
    const mngnToken = await ethers.getContractAt("IERC20", ADDRESSES.mNGN);

    // 1. Check token balances in the market
    console.log(`${colors.bright}=== Token Balances in Market ===${colors.reset}`);

    const musdBalance = await musdToken.balanceOf(ADDRESSES.MARKET);
    const mngnBalance = await mngnToken.balanceOf(ADDRESSES.MARKET);

    console.log(`mUSD Balance: ${colors.green}${ethers.utils.formatUnits(musdBalance, 6)} mUSD${colors.reset}`);
    console.log(`mNGN Balance: ${colors.green}${ethers.utils.formatUnits(mngnBalance, 18)} mNGN${colors.reset}`);

    // 2. Get pool amounts from DataStore
    console.log(`\n${colors.bright}=== Pool Amounts from DataStore ===${colors.reset}`);

    // Pool amount keys
    const poolAmountKeys = {
        musd: ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])),
                    ADDRESSES.MARKET,
                    ADDRESSES.mUSD
                ]
            )
        ),
        mngn: ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])),
                    ADDRESSES.MARKET,
                    ADDRESSES.mNGN
                ]
            )
        )
    };

    const poolAmountMUSD = await dataStore.getUint(poolAmountKeys.musd);
    const poolAmountMNGN = await dataStore.getUint(poolAmountKeys.mngn);

    console.log(`Pool Amount mUSD: ${colors.yellow}${ethers.utils.formatUnits(poolAmountMUSD, 6)} mUSD${colors.reset}`);
    console.log(`Pool Amount mNGN: ${colors.yellow}${ethers.utils.formatUnits(poolAmountMNGN, 18)} mNGN${colors.reset}`);

    // 3. Calculate USD values (assuming prices)
    console.log(`\n${colors.bright}=== USD Values (at current prices) ===${colors.reset}`);

    // Assume 1 mUSD = $1500, 1 mNGN = $1
    const musdPrice = 1500;
    const mngnPrice = 1;

    const musdValueUSD = parseFloat(ethers.utils.formatUnits(poolAmountMUSD, 6)) * musdPrice;
    const mngnValueUSD = parseFloat(ethers.utils.formatUnits(poolAmountMNGN, 18)) * mngnPrice;
    const totalPoolValueUSD = musdValueUSD + mngnValueUSD;

    console.log(`mUSD Value: ${colors.green}$${musdValueUSD.toFixed(2)}${colors.reset} (${ethers.utils.formatUnits(poolAmountMUSD, 6)} × $${musdPrice})`);
    console.log(`mNGN Value: ${colors.green}$${mngnValueUSD.toFixed(2)}${colors.reset} (${ethers.utils.formatUnits(poolAmountMNGN, 18)} × $${mngnPrice})`);
    console.log(`${colors.bright}Total Pool Value: ${colors.cyan}$${totalPoolValueUSD.toFixed(2)}${colors.reset}`);

    // 4. Get market token supply
    console.log(`\n${colors.bright}=== Market Token Info ===${colors.reset}`);

    const marketTokenSupply = await marketToken.totalSupply();
    console.log(`Market Token Supply: ${colors.magenta}${ethers.utils.formatUnits(marketTokenSupply, 18)}${colors.reset}`);

    if (marketTokenSupply.gt(0)) {
        const marketTokenPrice = totalPoolValueUSD / parseFloat(ethers.utils.formatUnits(marketTokenSupply, 18));
        console.log(`Market Token Price: ${colors.green}$${marketTokenPrice.toFixed(4)}${colors.reset} per token`);
    }

    // 5. Get open interest
    console.log(`\n${colors.bright}=== Open Interest ===${colors.reset}`);

    const openInterestKeys = {
        long: ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])),
                    ADDRESSES.MARKET,
                    ADDRESSES.mUSD,
                    true
                ]
            )
        ),
        short: ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])),
                    ADDRESSES.MARKET,
                    ADDRESSES.mUSD,
                    false
                ]
            )
        )
    };

    const longOpenInterest = await dataStore.getUint(openInterestKeys.long);
    const shortOpenInterest = await dataStore.getUint(openInterestKeys.short);

    console.log(`Long Open Interest: ${colors.cyan}$${ethers.utils.formatUnits(longOpenInterest, 30)}${colors.reset}`);
    console.log(`Short Open Interest: ${colors.cyan}$${ethers.utils.formatUnits(shortOpenInterest, 30)}${colors.reset}`);
    console.log(`Total Open Interest: ${colors.green}$${ethers.utils.formatUnits(longOpenInterest.add(shortOpenInterest), 30)}${colors.reset}`);

    // 6. Get reserved amounts
    console.log(`\n${colors.bright}=== Reserved Amounts ===${colors.reset}`);

    const reservedKeys = {
        musd: ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["RESERVED_AMOUNT"])),
                    ADDRESSES.MARKET,
                    ADDRESSES.mUSD
                ]
            )
        ),
        mngn: ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["RESERVED_AMOUNT"])),
                    ADDRESSES.MARKET,
                    ADDRESSES.mNGN
                ]
            )
        )
    };

    const reservedMUSD = await dataStore.getUint(reservedKeys.musd);
    const reservedMNGN = await dataStore.getUint(reservedKeys.mngn);

    console.log(`Reserved mUSD: ${colors.yellow}${ethers.utils.formatUnits(reservedMUSD, 6)} mUSD${colors.reset}`);
    console.log(`Reserved mNGN: ${colors.yellow}${ethers.utils.formatUnits(reservedMNGN, 18)} mNGN${colors.reset}`);

    // 7. Calculate available liquidity
    console.log(`\n${colors.bright}=== Available Liquidity ===${colors.reset}`);

    const availableMUSD = poolAmountMUSD.sub(reservedMUSD);
    const availableMNGN = poolAmountMNGN.sub(reservedMNGN);

    console.log(`Available mUSD: ${colors.green}${ethers.utils.formatUnits(availableMUSD, 6)} mUSD${colors.reset}`);
    console.log(`Available mNGN: ${colors.green}${ethers.utils.formatUnits(availableMNGN, 18)} mNGN${colors.reset}`);

    // 8. Impact pool amounts
    console.log(`\n${colors.bright}=== Impact Pool ===${colors.reset}`);

    const impactPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["IMPACT_POOL_AMOUNT"])),
                ADDRESSES.MARKET
            ]
        )
    );

    const impactPoolAmount = await dataStore.getUint(impactPoolKey);
    console.log(`Impact Pool Amount: ${colors.magenta}$${ethers.utils.formatUnits(impactPoolAmount, 30)}${colors.reset}`);

    // 9. Try to get market pool value from Reader
    console.log(`\n${colors.bright}=== Market Pool Value from Reader ===${colors.reset}`);
    try {
        const market = {
            marketToken: ADDRESSES.MARKET,
            indexToken: ADDRESSES.mUSD,
            longToken: ADDRESSES.mUSD,
            shortToken: ADDRESSES.mNGN
        };

        const indexTokenPrice = {
            min: ethers.utils.parseUnits("1500", 24), // 1500 with 24 decimals
            max: ethers.utils.parseUnits("1500", 24)
        };

        const longTokenPrice = {
            min: ethers.utils.parseUnits("1500", 24),
            max: ethers.utils.parseUnits("1500", 24)
        };

        const shortTokenPrice = {
            min: ethers.utils.parseUnits("1", 12), // 1 with 12 decimals for mNGN
            max: ethers.utils.parseUnits("1", 12)
        };

        const pnlFactorType = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR"));

        const [marketTokenPrice, poolValueInfo] = await reader.getMarketTokenPrice(
            ADDRESSES.DATA_STORE,
            market,
            indexTokenPrice,
            longTokenPrice,
            shortTokenPrice,
            pnlFactorType,
            false // maximize
        );

        console.log(`Market Token Price from Reader: ${colors.green}$${ethers.utils.formatUnits(marketTokenPrice, 30)}${colors.reset}`);
        console.log(`\nPool Value Info:`);
        console.log(`  Pool Value: ${colors.cyan}$${ethers.utils.formatUnits(poolValueInfo.poolValue, 30)}${colors.reset}`);
        console.log(`  Long PnL: ${colors.yellow}$${ethers.utils.formatUnits(poolValueInfo.longPnl, 30)}${colors.reset}`);
        console.log(`  Short PnL: ${colors.yellow}$${ethers.utils.formatUnits(poolValueInfo.shortPnl, 30)}${colors.reset}`);
        console.log(`  Net PnL: ${colors.magenta}$${ethers.utils.formatUnits(poolValueInfo.netPnl, 30)}${colors.reset}`);
        console.log(`  Total Borrowing Fees: ${colors.green}$${ethers.utils.formatUnits(poolValueInfo.totalBorrowingFees, 30)}${colors.reset}`);

    } catch (error) {
        console.log(`${colors.red}Could not get market pool value from Reader: ${error.message}${colors.reset}`);
    }

    // Summary
    console.log(`\n${colors.bright}=== Summary ===${colors.reset}`);
    console.log(`1. Pool has ${ethers.utils.formatUnits(poolAmountMUSD, 6)} mUSD and ${ethers.utils.formatUnits(poolAmountMNGN, 18)} mNGN`);
    console.log(`2. Total pool value: ~$${totalPoolValueUSD.toFixed(2)} USD`);
    console.log(`3. Open Interest: $${ethers.utils.formatUnits(longOpenInterest.add(shortOpenInterest), 30)}`);
    console.log(`4. Market is active with liquidity available for trading`);
}

async function main() {
    try {
        await checkPoolValue();
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