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

// Contract addresses for Market #9
const ADDRESSES = {
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",
    MARKET: "0x5E63276Caae0FF49b2762b98A1d37941AA50F804",  // Market 9: mUSDTNGN/mUSD/mNGN
    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827",
    REFERRAL_STORAGE: "0x5D7470aC842ccec006e7b83B757C8a26e3B9B23A" // May be needed for some Reader calls
};

// Known accounts to check (add more as needed)
const ACCOUNTS_TO_CHECK = [
    "0xB880CBFE2fb746838719805CEcE154b58D03A79b",
    "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292"
];

async function readPositionsViaReader() {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}=== Reading Positions via Reader Contract ===${colors.reset}`);
    console.log(`Reader: ${colors.cyan}${ADDRESSES.READER}${colors.reset}`);
    console.log(`Market: ${colors.yellow}mUSDTNGN/mUSD/mNGN (Market #9)${colors.reset}`);
    console.log(`Market Address: ${colors.cyan}${ADDRESSES.MARKET}${colors.reset}`);

    // Get Reader contract
    const reader = await ethers.getContractAt("Reader", ADDRESSES.READER);

    // Add signer address to accounts to check
    const accountsToCheck = [...new Set([signer.address, ...ACCOUNTS_TO_CHECK])];

    console.log(`\n${colors.bright}Checking ${accountsToCheck.length} accounts for positions...${colors.reset}`);

    const allPositions = [];

    for (const account of accountsToCheck) {
        console.log(`\n${colors.bright}Account: ${colors.cyan}${account}${colors.reset}`);

        if (account.toLowerCase() === signer.address.toLowerCase()) {
            console.log(`  ${colors.green}(Your Account)${colors.reset}`);
        }

        // Check both long and short positions
        for (const isLong of [true, false]) {
            try {
                // Calculate position key
                const positionKey = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ["address", "address", "address", "bool"],
                        [account, ADDRESSES.MARKET, ADDRESSES.mUSD, isLong]
                    )
                );

                // Try to get position from Reader
                // Note: Reader.getPosition returns a Position struct
                const position = await reader.getPosition(
                    ADDRESSES.DATA_STORE,
                    positionKey
                );

                // Check if position exists (size > 0)
                if (position && position.numbers && position.numbers.sizeInUsd && position.numbers.sizeInUsd.gt(0)) {
                    allPositions.push({
                        account,
                        isLong,
                        position,
                        positionKey
                    });

                    console.log(`\n  ${colors.bright}${isLong ? 'LONG' : 'SHORT'} Position Found:${colors.reset}`);
                    console.log(`    Position Key: ${colors.magenta}${positionKey}${colors.reset}`);
                    console.log(`    Size in USD: ${colors.green}$${ethers.utils.formatUnits(position.numbers.sizeInUsd, 30)}${colors.reset}`);
                    console.log(`    Size in Tokens RAW: ${position.numbers.sizeInTokens.toString()}`);
                    console.log(`    Size in Tokens (mNGN): ${colors.yellow}${ethers.utils.formatUnits(position.numbers.sizeInTokens, 18)}${colors.reset}`);
                    console.log(`    Collateral: ${colors.yellow}${ethers.utils.formatUnits(position.numbers.collateralAmount, 6)} mUSD${colors.reset}`);

                    // Calculate leverage
                    if (position.numbers.collateralAmount.gt(0)) {
                        const collateralInUsd30 = position.numbers.collateralAmount.mul(ethers.utils.parseUnits("1", 24));
                        const leverage = position.numbers.sizeInUsd.mul(100).div(collateralInUsd30);
                        console.log(`    Leverage: ${colors.magenta}~${leverage.toNumber() / 100}x${colors.reset}`);
                    }

                    // Display additional position info if available
                    if (position.numbers.borrowingFactor) {
                        console.log(`    Borrowing Factor: ${position.numbers.borrowingFactor.toString()}`);
                    }
                    if (position.numbers.fundingFeeAmountPerSize) {
                        console.log(`    Funding Fee Per Size: ${position.numbers.fundingFeeAmountPerSize.toString()}`);
                    }
                }
            } catch (error) {
                // Position doesn't exist or error reading
                // This is normal - not all accounts have both long and short positions
                if (error.message && !error.message.includes("revert")) {
                    console.log(`  ${colors.yellow}Error checking ${isLong ? 'long' : 'short'}: ${error.message}${colors.reset}`);
                }
            }
        }
    }

    // Summary
    console.log(`\n${colors.bright}=== Summary ===${colors.reset}`);
    console.log(`Total positions found: ${colors.green}${allPositions.length}${colors.reset}`);

    if (allPositions.length > 0) {
        // Calculate total OI
        let totalLongOI = ethers.BigNumber.from(0);
        let totalShortOI = ethers.BigNumber.from(0);

        for (const pos of allPositions) {
            if (pos.isLong) {
                totalLongOI = totalLongOI.add(pos.position.numbers.sizeInUsd);
            } else {
                totalShortOI = totalShortOI.add(pos.position.numbers.sizeInUsd);
            }
        }

        console.log(`\n${colors.bright}Open Interest:${colors.reset}`);
        console.log(`  Long: ${colors.cyan}$${ethers.utils.formatUnits(totalLongOI, 30)}${colors.reset}`);
        console.log(`  Short: ${colors.cyan}$${ethers.utils.formatUnits(totalShortOI, 30)}${colors.reset}`);
        console.log(`  Total: ${colors.green}$${ethers.utils.formatUnits(totalLongOI.add(totalShortOI), 30)}${colors.reset}`);
    }

    // Try to get market info from Reader
    console.log(`\n${colors.bright}=== Market Info from Reader ===${colors.reset}`);
    try {
        const market = await reader.getMarket(ADDRESSES.DATA_STORE, ADDRESSES.MARKET);

        if (market) {
            console.log(`\nMarket Token: ${colors.cyan}${market.marketToken}${colors.reset}`);
            console.log(`Index Token: ${colors.yellow}${market.indexToken}${colors.reset}`);
            console.log(`Long Token: ${colors.yellow}${market.longToken}${colors.reset}`);
            console.log(`Short Token: ${colors.yellow}${market.shortToken}${colors.reset}`);

            // Try to get market prices
            try {
                const prices = await reader.getMarketTokenPrice(
                    ADDRESSES.DATA_STORE,
                    market,
                    {
                        indexTokenPrice: {
                            min: ethers.utils.parseUnits("1", 12), // 1 with 12 decimals for mNGN (18 decimals) as index
                            max: ethers.utils.parseUnits("1", 12)
                        },
                        longTokenPrice: {
                            min: ethers.utils.parseUnits("1500", 24), // 1500 with 24 decimals for mUSD (6 decimals)
                            max: ethers.utils.parseUnits("1500", 24)
                        },
                        shortTokenPrice: {
                            min: ethers.utils.parseUnits("1", 12), // 1 with 12 decimals for mNGN (18 decimals)
                            max: ethers.utils.parseUnits("1", 12)
                        }
                    },
                    0, // pnlFactorType (0 for default)
                    false // maximize
                );

                if (prices && prices.length > 0) {
                    console.log(`\nMarket Token Price: ${colors.green}$${ethers.utils.formatUnits(prices[0], 30)}${colors.reset}`);
                }
            } catch (priceError) {
                console.log(`\n${colors.yellow}Could not fetch market token price: ${priceError.message}${colors.reset}`);
            }
        }
    } catch (error) {
        console.log(`${colors.yellow}Could not fetch market info: ${error.message}${colors.reset}`);
    }
}

async function main() {
    try {
        await readPositionsViaReader();
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