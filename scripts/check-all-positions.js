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
    READER: "0xEd33c3C6792e5Bd5Ad60DcD66Ad5Ed6493b34cd8" // If you have a Reader contract
};

async function checkAllPositions() {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}=== Checking All Positions in Market ===${colors.reset}`);
    console.log(`Market: ${colors.cyan}${ADDRESSES.MARKET}${colors.reset}`);

    // Get DataStore contract
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    // Get position keys from the position list
    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    // Note: This is a simplified approach - in reality you'd need to iterate through
    // the position list properly. For now, let's check known accounts.

    // The correct way to get positions is from the POSITION_LIST
    // First get the count of positions
    const positionCount = await dataStore.getBytes32Count(POSITION_LIST);
    console.log(`\n${colors.bright}Total positions in market: ${positionCount.toString()}${colors.reset}`);

    // Get each position key and extract account from it
    const foundAccounts = new Set();

    for (let i = 0; i < positionCount.toNumber(); i++) {
        try {
            // Get position keys from the list
            const positionKeys = await dataStore.getBytes32ValuesAt(POSITION_LIST, i, i + 1);
            if (positionKeys && positionKeys.length > 0) {
                const positionKey = positionKeys[0];

                // Get the account address for this position
                // The account is stored in the position data
                const accountKey = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ["bytes32", "bytes32"],
                        [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"]))]
                    )
                );
                const account = await dataStore.getAddress(accountKey);

                if (account && account !== ethers.constants.AddressZero) {
                    foundAccounts.add(account);
                }
            }
        } catch (error) {
            console.log(`${colors.yellow}Error reading position ${i}: ${error.message}${colors.reset}`);
        }
    }

    // Now check positions for each found account
    console.log(`\n${colors.bright}Found ${foundAccounts.size} unique accounts with positions${colors.reset}`);

    // Always check your own account first
    console.log(`\n${colors.bright}Your Account: ${signer.address}${colors.reset}`);
    await checkAccountPositions(dataStore, signer.address);

    // Check other accounts
    let accountIndex = 1;
    for (const account of foundAccounts) {
        if (account.toLowerCase() !== signer.address.toLowerCase()) {
            console.log(`\n${colors.bright}Account ${accountIndex}: ${account}${colors.reset}`);
            await checkAccountPositions(dataStore, account);
            accountIndex++;
        }
    }

    // Check open interest to verify
    const longOI = await getOpenInterest(dataStore, true);
    const shortOI = await getOpenInterest(dataStore, false);

    console.log(`\n${colors.bright}Total Open Interest:${colors.reset}`);
    console.log(`  Long: ${colors.cyan}$${ethers.utils.formatUnits(longOI, 30)}${colors.reset}`);
    console.log(`  Short: ${colors.cyan}$${ethers.utils.formatUnits(shortOI, 30)}${colors.reset}`);
}

async function checkAccountPositions(dataStore, account) {
    // Check both long and short positions
    for (const isLong of [true, false]) {
        const positionKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address", "bool"],
                [account, ADDRESSES.MARKET, ADDRESSES.USDT, isLong]
            )
        );

        // Check if position exists
        const POSITION_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
        );

        const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);

        if (positionExists) {
            // Get position data
            const sizeInUsd = await getPositionData(dataStore, positionKey, "SIZE_IN_USD");
            const sizeInTokens = await getPositionData(dataStore, positionKey, "SIZE_IN_TOKENS");
            const collateralAmount = await getPositionData(dataStore, positionKey, "COLLATERAL_AMOUNT");

            const sizeUsd = ethers.utils.formatUnits(sizeInUsd, 30);
            const tokens = ethers.utils.formatUnits(sizeInTokens, 6); // USDT has 6 decimals
            const collateral = ethers.utils.formatUnits(collateralAmount, 6);

            // Calculate leverage
            const leverage = collateralAmount.gt(0) ?
                sizeInUsd.div(collateralAmount.mul(ethers.BigNumber.from(10).pow(24))) :
                ethers.BigNumber.from(0);

            console.log(`  ${colors.bright}${isLong ? 'LONG' : 'SHORT'} Position:${colors.reset}`);
            console.log(`    Size: ${colors.green}$${sizeUsd}${colors.reset}`);
            console.log(`    Size in Tokens: ${colors.yellow}${tokens} USDT${colors.reset}`);
            console.log(`    Collateral: ${colors.yellow}${collateral} USDT${colors.reset}`);
            console.log(`    Leverage: ${colors.magenta}${leverage}x${colors.reset}`);

            // Calculate if liquidatable
            const minCollateralFactor = ethers.utils.parseUnits("0.01", 30); // 1% = 100x leverage
            const minCollateral = sizeInUsd.mul(minCollateralFactor).div(ethers.utils.parseUnits("1", 30));
            const collateralUsd = collateralAmount.mul(ethers.BigNumber.from(10).pow(24)); // Convert to USD with precision 30

            if (collateralUsd.lt(minCollateral)) {
                console.log(`    ${colors.red}⚠️  LIQUIDATABLE${colors.reset}`);
            } else {
                console.log(`    ${colors.green}✓ Not liquidatable${colors.reset}`);
            }
        }
    }
}

async function getPositionData(dataStore, positionKey, field) {
    const fieldHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], [field])
    );
    const key = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [positionKey, fieldHash]
        )
    );
    return dataStore.getUint(key);
}

async function getOpenInterest(dataStore, isLong) {
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

async function main() {
    try {
        await checkAllPositions();

        console.log(`\n${colors.bright}=== Options to Force Close ===${colors.reset}`);
        console.log(`1. ${colors.yellow}Liquidation:${colors.reset} Move oracle prices to make positions underwater`);
        console.log(`   - For longs: Set USDT price very low (e.g., $0.01)`);
        console.log(`   - For shorts: Set USDT price very high (e.g., $10000)`);
        console.log(`2. ${colors.yellow}ADL:${colors.reset} Requires extreme PnL imbalance (not practical)`);
        console.log(`3. ${colors.yellow}Wait:${colors.reset} Disable market and wait for owners to close`);

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