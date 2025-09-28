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
    MARKET: "0xf7F4Bb2014A164A919Ccec2b97Bd4805f86B83aD",  // Market 7: mUSD/mUSD/mNGN
    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827"
};

async function findAllPositions() {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}=== Finding All Positions in Market #7 ===${colors.reset}`);
    console.log(`Market: ${colors.cyan}${ADDRESSES.MARKET}${colors.reset}`);
    console.log(`Market Type: ${colors.yellow}mUSD/mUSD/mNGN${colors.reset}`);

    // Get DataStore contract
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    // Get position keys from the position list
    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    // Get the count of all positions in the system
    const totalPositionCount = await dataStore.getBytes32Count(POSITION_LIST);
    console.log(`\n${colors.bright}Total positions in system: ${totalPositionCount.toString()}${colors.reset}`);

    // Arrays to store found positions
    const market7Positions = [];
    const accountsWithPositions = new Set();

    console.log(`\n${colors.bright}Scanning for Market #7 positions...${colors.reset}`);

    // Iterate through all positions
    for (let i = 0; i < totalPositionCount.toNumber(); i++) {
        try {
            // Get position key from the list
            const positionKeys = await dataStore.getBytes32ValuesAt(POSITION_LIST, i, i + 1);
            if (positionKeys && positionKeys.length > 0) {
                const positionKey = positionKeys[0];

                // Get the market for this position
                const marketKey = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ["bytes32", "bytes32"],
                        [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET"]))]
                    )
                );
                const positionMarket = await dataStore.getAddress(marketKey);

                // Check if this position belongs to Market #7
                if (positionMarket.toLowerCase() === ADDRESSES.MARKET.toLowerCase()) {
                    // Get position details
                    const accountKey = ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                            ["bytes32", "bytes32"],
                            [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"]))]
                        )
                    );
                    const account = await dataStore.getAddress(accountKey);

                    const collateralTokenKey = ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                            ["bytes32", "bytes32"],
                            [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["COLLATERAL_TOKEN"]))]
                        )
                    );
                    const collateralToken = await dataStore.getAddress(collateralTokenKey);

                    const isLongKey = ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                            ["bytes32", "bytes32"],
                            [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["IS_LONG"]))]
                        )
                    );
                    const isLong = await dataStore.getBool(isLongKey);

                    const sizeInUsdKey = ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                            ["bytes32", "bytes32"],
                            [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["SIZE_IN_USD"]))]
                        )
                    );
                    const sizeInUsd = await dataStore.getUint(sizeInUsdKey);

                    const collateralAmountKey = ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                            ["bytes32", "bytes32"],
                            [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["COLLATERAL_AMOUNT"]))]
                        )
                    );
                    const collateralAmount = await dataStore.getUint(collateralAmountKey);

                    // Determine collateral token info
                    let collateralSymbol, collateralDecimals;
                    if (collateralToken.toLowerCase() === ADDRESSES.mUSD.toLowerCase()) {
                        collateralSymbol = "mUSD";
                        collateralDecimals = 6;
                    } else if (collateralToken.toLowerCase() === ADDRESSES.mNGN.toLowerCase()) {
                        collateralSymbol = "mNGN";
                        collateralDecimals = 18;
                    } else {
                        collateralSymbol = "UNKNOWN";
                        collateralDecimals = 18;
                    }

                    market7Positions.push({
                        account,
                        positionKey,
                        isLong,
                        sizeInUsd,
                        collateralAmount,
                        collateralToken,
                        collateralSymbol,
                        collateralDecimals
                    });

                    accountsWithPositions.add(account);
                }
            }
        } catch (error) {
            console.log(`${colors.yellow}Error reading position ${i}: ${error.message}${colors.reset}`);
        }
    }

    // Display results
    console.log(`\n${colors.bright}=== Market #7 Position Summary ===${colors.reset}`);
    console.log(`Found ${colors.green}${market7Positions.length}${colors.reset} positions in Market #7`);
    console.log(`Unique accounts: ${colors.cyan}${accountsWithPositions.size}${colors.reset}`);

    if (market7Positions.length > 0) {
        console.log(`\n${colors.bright}=== Position Details ===${colors.reset}`);

        // Group positions by account
        const positionsByAccount = {};
        for (const pos of market7Positions) {
            if (!positionsByAccount[pos.account]) {
                positionsByAccount[pos.account] = [];
            }
            positionsByAccount[pos.account].push(pos);
        }

        // Display positions for each account
        let accountIndex = 1;
        for (const [account, positions] of Object.entries(positionsByAccount)) {
            console.log(`\n${colors.bright}Account ${accountIndex}: ${colors.cyan}${account}${colors.reset}`);

            // Check if this is the current signer
            if (account.toLowerCase() === signer.address.toLowerCase()) {
                console.log(`  ${colors.green}(Your Account)${colors.reset}`);
            }

            for (const pos of positions) {
                const sizeFormatted = ethers.utils.formatUnits(pos.sizeInUsd, 30);
                const collateralFormatted = ethers.utils.formatUnits(pos.collateralAmount, pos.collateralDecimals);

                // Calculate leverage
                let leverage = "N/A";
                if (pos.collateralAmount.gt(0)) {
                    if (pos.collateralSymbol === "mUSD") {
                        // For mUSD, both size and collateral are in USD terms
                        // Size is in 30 decimals, mUSD collateral is in 6 decimals
                        // So we need to adjust: size(30) / (collateral(6) * 10^24)
                        const collateralInUsd30 = pos.collateralAmount.mul(ethers.utils.parseUnits("1", 24));
                        leverage = pos.sizeInUsd.mul(100).div(collateralInUsd30).toNumber() / 100;
                    } else if (pos.collateralSymbol === "mNGN") {
                        // For mNGN, convert to USD value (1 mNGN = 1/1500 USD)
                        // mNGN has 18 decimals, so collateral in USD(30) = mNGN(18) * 10^12 / 1500
                        const collateralInUsd30 = pos.collateralAmount.mul(ethers.utils.parseUnits("1", 12)).div(1500);
                        leverage = pos.sizeInUsd.mul(100).div(collateralInUsd30).toNumber() / 100;
                    }
                }

                console.log(`\n  ${colors.bright}${pos.isLong ? 'LONG' : 'SHORT'} Position:${colors.reset}`);
                console.log(`    Position Key: ${colors.magenta}${pos.positionKey}${colors.reset}`);
                console.log(`    Size: ${colors.green}$${sizeFormatted} USD${colors.reset}`);
                console.log(`    Collateral: ${colors.yellow}${collateralFormatted} ${pos.collateralSymbol}${colors.reset}`);
                console.log(`    Leverage: ${colors.magenta}~${leverage}x${colors.reset}`);
            }
            accountIndex++;
        }

        // Calculate total open interest
        let totalLongOI = ethers.BigNumber.from(0);
        let totalShortOI = ethers.BigNumber.from(0);

        for (const pos of market7Positions) {
            if (pos.isLong) {
                totalLongOI = totalLongOI.add(pos.sizeInUsd);
            } else {
                totalShortOI = totalShortOI.add(pos.sizeInUsd);
            }
        }

        console.log(`\n${colors.bright}=== Market #7 Open Interest ===${colors.reset}`);
        console.log(`Total Long OI: ${colors.cyan}$${ethers.utils.formatUnits(totalLongOI, 30)} USD${colors.reset}`);
        console.log(`Total Short OI: ${colors.cyan}$${ethers.utils.formatUnits(totalShortOI, 30)} USD${colors.reset}`);
        console.log(`Total OI: ${colors.green}$${ethers.utils.formatUnits(totalLongOI.add(totalShortOI), 30)} USD${colors.reset}`);

        // Also verify with direct OI query
        console.log(`\n${colors.bright}=== Verifying with Direct OI Query ===${colors.reset}`);

        const longOIKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])),
                    ADDRESSES.MARKET,
                    ADDRESSES.mUSD,  // Collateral token
                    true  // isLong
                ]
            )
        );
        const directLongOI = await dataStore.getUint(longOIKey);

        const shortOIKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])),
                    ADDRESSES.MARKET,
                    ADDRESSES.mUSD,  // Collateral token (mUSD for both long and short in this market)
                    false  // isLong
                ]
            )
        );
        const directShortOI = await dataStore.getUint(shortOIKey);

        console.log(`Direct Long OI: ${colors.cyan}$${ethers.utils.formatUnits(directLongOI, 30)} USD${colors.reset}`);
        console.log(`Direct Short OI: ${colors.cyan}$${ethers.utils.formatUnits(directShortOI, 30)} USD${colors.reset}`);

    } else {
        console.log(`\n${colors.yellow}No positions found in Market #7${colors.reset}`);
    }
}

async function main() {
    try {
        await findAllPositions();
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