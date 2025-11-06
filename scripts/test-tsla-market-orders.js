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

// Contract addresses for TSLA/USD Market
const ADDRESSES = {
    EXCHANGE_ROUTER: "0x3B33708e9b8242999459EB9b4756C24c846e5936",
    ORDER_VAULT: "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F",
    ROUTER: "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc",
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    MARKET: "0x8ae559448a1482faffC925eF6a233276588348Df", // Market 11: mTSLA/mUSD/mUSD
    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    mTSLA: "0x77d4DdD2E847592fb7710e342C0492A4b85655f4",
    EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C",
    MOCK_PROVIDER: "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5"
};

// Order types enum
const OrderTypes = {
    MarketSwap: 0,
    LimitSwap: 1,
    MarketIncrease: 2,
    LimitIncrease: 3,
    MarketDecrease: 4,
    LimitDecrease: 5,
    StopLossDecrease: 6,
    Liquidation: 7
};

function printUsage() {
    console.log(`
${colors.bright}USAGE:${colors.reset}
  ACTION=<action> [OPTIONS] npx hardhat run scripts/test-tsla-market-orders.js --network arbitrumSepolia

${colors.bright}ACTIONS:${colors.reset}
  ${colors.cyan}check${colors.reset}              Check current position status
  ${colors.cyan}open${colors.reset}               Open a new position
  ${colors.cyan}increase${colors.reset}           Increase an existing position
  ${colors.cyan}decrease${colors.reset}           Decrease an existing position
  ${colors.cyan}close${colors.reset}              Close entire position
  ${colors.cyan}set-price${colors.reset}          Update oracle price for mTSLA

${colors.bright}OPTIONS (as environment variables):${colors.reset}
  SIDE=<long|short>      Position side (required for open/increase/decrease/close)
  SIZE=<number>          Size in USD (required for open/increase)
  COLLATERAL=<number>    Collateral in mUSD (required for open/increase)
  PERCENT=<number>       Percentage to close (for decrease, default: 50)
  AMOUNT=<number>        Specific USD amount to decrease
  PRICE=<number>         New price in USD (for set-price)

${colors.bright}MARKET INFO:${colors.reset}
  Market: ${colors.yellow}mTSLA/mUSD/mUSD (Market #11)${colors.reset}
  Index Token: mTSLA (TSLA stock price tracker)
  Long Token: mUSD (collateral for longs)
  Short Token: mUSD (collateral for shorts - single-token market)
  Pricing: mTSLA at ~$428, mUSD = $1

${colors.bright}EXAMPLES:${colors.reset}
  # Check current positions
  ACTION=check npx hardhat run scripts/test-tsla-market-orders.js --network arbitrumSepolia

  # Open a long position ($1,000 size with 100 mUSD collateral = 10x leverage)
  ACTION=open SIDE=long SIZE=1000 COLLATERAL=100 npx hardhat run scripts/test-tsla-market-orders.js --network arbitrumSepolia

  # Open a short position ($2,000 size with 200 mUSD collateral = 10x leverage)
  ACTION=open SIDE=short SIZE=2000 COLLATERAL=200 npx hardhat run scripts/test-tsla-market-orders.js --network arbitrumSepolia

  # Increase a position
  ACTION=increase SIDE=long SIZE=500 COLLATERAL=50 npx hardhat run scripts/test-tsla-market-orders.js --network arbitrumSepolia

  # Decrease 50% of position
  ACTION=decrease SIDE=long PERCENT=50 npx hardhat run scripts/test-tsla-market-orders.js --network arbitrumSepolia

  # Decrease specific amount
  ACTION=decrease SIDE=short AMOUNT=500 npx hardhat run scripts/test-tsla-market-orders.js --network arbitrumSepolia

  # Close entire position
  ACTION=close SIDE=long npx hardhat run scripts/test-tsla-market-orders.js --network arbitrumSepolia

  # Update mTSLA price to $450
  ACTION=set-price PRICE=450 npx hardhat run scripts/test-tsla-market-orders.js --network arbitrumSepolia
`);
}

function parseArgs() {
    // Read from environment variables instead of command line arguments
    const action = process.env.ACTION || 'help';

    const options = {
        side: process.env.SIDE,
        size: process.env.SIZE,
        collateral: process.env.COLLATERAL,
        percent: process.env.PERCENT,
        amount: process.env.AMOUNT,
        price: process.env.PRICE
    };

    // Remove undefined values
    Object.keys(options).forEach(key => {
        if (options[key] === undefined) {
            delete options[key];
        }
    });

    return { action, options };
}

async function checkPosition(signer, side = null) {
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const account = signer.address;

    console.log(`\n${colors.bright}=== Position Status ===${colors.reset}`);
    console.log(`Account: ${colors.cyan}${account}${colors.reset}`);
    console.log(`Market: ${colors.yellow}mTSLA/mUSD/mUSD${colors.reset}`);

    // Check both long and short if side not specified
    const sidesToCheck = side ? [side] : ['long', 'short'];

    for (const checkSide of sidesToCheck) {
        const isLong = checkSide === 'long';
        const collateralToken = ADDRESSES.mUSD; // mUSD is collateral for both long and short

        const positionKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address", "bool"],
                [account, ADDRESSES.MARKET, collateralToken, isLong]
            )
        );

        const POSITION_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
        );

        const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);

        if (positionExists) {
            // Get position data
            const getPositionData = async (field) => {
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
            };

            const sizeInUsd = await getPositionData("SIZE_IN_USD");
            const collateralAmount = await getPositionData("COLLATERAL_AMOUNT");

            console.log(`\n${colors.bright}${checkSide.toUpperCase()} Position:${colors.reset}`);
            console.log(`  Size: ${colors.green}$${ethers.utils.formatUnits(sizeInUsd, 30)}${colors.reset}`);
            console.log(`  Collateral: ${colors.yellow}${ethers.utils.formatUnits(collateralAmount, 6)} mUSD${colors.reset}`);

            // Calculate leverage (size in USD / collateral in mUSD)
            if (collateralAmount.gt(0)) {
                const leverage = parseFloat(ethers.utils.formatUnits(sizeInUsd, 30)) /
                                parseFloat(ethers.utils.formatUnits(collateralAmount, 6));
                console.log(`  Leverage: ${colors.magenta}${leverage.toFixed(2)}x${colors.reset}`);
            }
        } else {
            console.log(`\n${colors.bright}${checkSide.toUpperCase()} Position:${colors.reset} ${colors.red}No position${colors.reset}`);
        }
    }

    return true;
}

async function createOrder(signer, orderType, orderParams) {
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const collateralToken = await ethers.getContractAt("IERC20", ADDRESSES.mUSD);

    // Build multicall data
    const multicallData = [];
    const executionFee = ethers.utils.parseEther("0.001");

    // 1. Send execution fee
    multicallData.push(
        exchangeRouter.interface.encodeFunctionData("sendWnt", [
            ADDRESSES.ORDER_VAULT,
            executionFee
        ])
    );

    // 2. For increase orders, approve and send collateral
    if (orderType === OrderTypes.MarketIncrease && orderParams.collateralAmount) {
        // Check and approve collateral token
        const allowance = await collateralToken.allowance(signer.address, ADDRESSES.ROUTER);
        if (allowance.lt(orderParams.collateralAmount)) {
            console.log(`  ${colors.yellow}Approving mUSD...${colors.reset}`);
            await (await collateralToken.approve(ADDRESSES.ROUTER, 0)).wait();
            await (await collateralToken.approve(ADDRESSES.ROUTER, orderParams.collateralAmount)).wait();
        }

        multicallData.push(
            exchangeRouter.interface.encodeFunctionData("sendTokens", [
                ADDRESSES.mUSD,
                ADDRESSES.ORDER_VAULT,
                orderParams.collateralAmount
            ])
        );
    }

    // 3. Create order
    let decreasePositionSwapType = 0; // NoSwap by default

    const createOrderParams = {
        addresses: {
            receiver: signer.address,
            cancellationReceiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialCollateralToken: ADDRESSES.mUSD,
            swapPath: []
        },
        numbers: {
            sizeDeltaUsd: orderParams.sizeDeltaUsd,
            initialCollateralDeltaAmount: orderParams.collateralAmount || 0,
            triggerPrice: 0,
            acceptablePrice: orderParams.acceptablePrice || 0,
            executionFee: executionFee,
            callbackGasLimit: 0,
            minOutputAmount: 0,
            validFromTime: 0
        },
        orderType: orderType,
        decreasePositionSwapType: decreasePositionSwapType,
        isLong: orderParams.isLong,
        shouldUnwrapNativeToken: false,
        autoCancel: false,
        referralCode: ethers.constants.HashZero,
        dataList: []
    };

    multicallData.push(
        exchangeRouter.interface.encodeFunctionData("createOrder", [createOrderParams])
    );

    // Execute transaction
    console.log(`\n${colors.yellow}Creating order...${colors.reset}`);
    const tx = await exchangeRouter.multicall(multicallData, {
        value: executionFee,
        gasLimit: 3000000
    });

    console.log(`Transaction: ${colors.cyan}${tx.hash}${colors.reset}`);
    const receipt = await tx.wait();

    // Find order key from events
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
    const ORDER_CREATED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCreated"));

    let orderKey = null;
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === ADDRESSES.EVENT_EMITTER.toLowerCase() &&
            log.topics[0] === EVENT_LOG2_SIG &&
            log.topics[1] === ORDER_CREATED_HASH) {
            orderKey = log.topics[2];
            break;
        }
    }

    console.log(`${colors.green}✅ Order created!${colors.reset}`);
    if (orderKey) {
        console.log(`Order Key: ${colors.magenta}${orderKey}${colors.reset}`);
    }
    console.log(`View on Arbiscan: ${colors.blue}https://sepolia.arbiscan.io/tx/${tx.hash}${colors.reset}`);

    return receipt;
}

async function openPosition(signer, options) {
    const { side, size, collateral } = options;

    if (!side || !size || !collateral) {
        console.log(`${colors.red}Error: Missing required options for open position${colors.reset}`);
        console.log("Required: SIDE=<long|short> SIZE=<usd_amount> COLLATERAL=<musd_amount>");
        return;
    }

    const isLong = side === 'long';
    const sizeDeltaUsd = ethers.utils.parseUnits(size, 30); // Size in USD
    const collateralAmount = ethers.utils.parseUnits(collateral, 6); // mUSD (6 decimals)

    console.log(`\n${colors.bright}Opening ${side.toUpperCase()} Position on TSLA:${colors.reset}`);
    console.log(`  Size: ${colors.green}$${size}${colors.reset}`);
    console.log(`  Collateral: ${colors.yellow}${collateral} mUSD${colors.reset}`);

    // Calculate leverage
    const leverage = parseFloat(size) / parseFloat(collateral);
    console.log(`  Leverage: ${colors.magenta}${leverage.toFixed(2)}x${colors.reset}`);

    // Set acceptablePrice for position opens
    let acceptablePrice = 0;
    if (isLong) {
        // For opening longs, set max acceptable price (e.g., $1000 per TSLA share)
        acceptablePrice = ethers.utils.parseUnits("1000", 12); // 1000 with 12 decimals (30 - 18 for mTSLA)
        console.log(`  ${colors.cyan}Setting acceptablePrice to $1000 per TSLA share for long open${colors.reset}`);
    } else {
        // For opening shorts, use 0 or set a min acceptable price
        acceptablePrice = 0;
        console.log(`  ${colors.cyan}Setting acceptablePrice to 0 for short open${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.MarketIncrease, {
        sizeDeltaUsd,
        collateralAmount,
        isLong,
        acceptablePrice
    });
}

async function increasePosition(signer, options) {
    const { side, size, collateral } = options;

    if (!side || !size || !collateral) {
        console.log(`${colors.red}Error: Missing required options for increase position${colors.reset}`);
        console.log("Required: SIDE=<long|short> SIZE=<usd_amount> COLLATERAL=<musd_amount>");
        return;
    }

    // Check if position exists
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const isLong = side === 'long';

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, ADDRESSES.MARKET, ADDRESSES.mUSD, isLong]
        )
    );

    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);
    if (!positionExists) {
        console.log(`${colors.red}No ${side} position exists to increase${colors.reset}`);
        return;
    }

    const sizeDeltaUsd = ethers.utils.parseUnits(size, 30); // Size in USD
    const collateralAmount = ethers.utils.parseUnits(collateral, 6); // mUSD

    console.log(`\n${colors.bright}Increasing ${side.toUpperCase()} Position:${colors.reset}`);
    console.log(`  Additional Size: ${colors.green}$${size}${colors.reset}`);
    console.log(`  Additional Collateral: ${colors.yellow}${collateral} mUSD${colors.reset}`);

    // Set acceptablePrice for position increases
    let acceptablePrice = 0;
    if (isLong) {
        acceptablePrice = ethers.utils.parseUnits("1000", 12);
        console.log(`  ${colors.cyan}Setting acceptablePrice to $1000 per TSLA share for long increase${colors.reset}`);
    } else {
        acceptablePrice = 0;
        console.log(`  ${colors.cyan}Setting acceptablePrice to 0 for short increase${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.MarketIncrease, {
        sizeDeltaUsd,
        collateralAmount,
        isLong,
        acceptablePrice
    });
}

async function decreasePosition(signer, options) {
    const { side, percent, amount } = options;

    if (!side) {
        console.log(`${colors.red}Error: Missing SIDE option${colors.reset}`);
        return;
    }

    // Check position exists and get current size
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const isLong = side === 'long';

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, ADDRESSES.MARKET, ADDRESSES.mUSD, isLong]
        )
    );

    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);
    if (!positionExists) {
        console.log(`${colors.red}No ${side} position exists to decrease${colors.reset}`);
        return;
    }

    // Get current position size
    const sizeKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["SIZE_IN_USD"]))]
        )
    );
    const currentSize = await dataStore.getUint(sizeKey);

    let sizeDeltaUsd;
    if (percent) {
        sizeDeltaUsd = currentSize.mul(percent).div(100);
        console.log(`\n${colors.bright}Decreasing ${side.toUpperCase()} Position by ${percent}%:${colors.reset}`);
    } else if (amount) {
        sizeDeltaUsd = ethers.utils.parseUnits(amount, 30);
        console.log(`\n${colors.bright}Decreasing ${side.toUpperCase()} Position by $${amount}:${colors.reset}`);
    } else {
        // Default to 50%
        sizeDeltaUsd = currentSize.div(2);
        console.log(`\n${colors.bright}Decreasing ${side.toUpperCase()} Position by 50% (default):${colors.reset}`);
    }

    console.log(`  Current Size: ${colors.yellow}$${ethers.utils.formatUnits(currentSize, 30)}${colors.reset}`);
    console.log(`  Decrease Amount: ${colors.red}$${ethers.utils.formatUnits(sizeDeltaUsd, 30)}${colors.reset}`);

    // Calculate collateral to withdraw (proportional to size decrease)
    const collateralKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["COLLATERAL_AMOUNT"]))]
        )
    );
    const currentCollateral = await dataStore.getUint(collateralKey);
    const collateralToWithdraw = currentCollateral.mul(sizeDeltaUsd).div(currentSize);

    console.log(`  Collateral to Withdraw: ${colors.green}${ethers.utils.formatUnits(collateralToWithdraw, 6)} mUSD${colors.reset}`);

    // Set acceptablePrice based on position type
    let acceptablePrice = 0;
    if (isLong) {
        // For decreasing longs, use min acceptable price (e.g., $300 per TSLA share)
        acceptablePrice = ethers.utils.parseUnits("300", 12);
        console.log(`  ${colors.cyan}Setting acceptablePrice to $300 per TSLA share for long decrease${colors.reset}`);
    } else {
        // For decreasing shorts, set max acceptable price
        acceptablePrice = ethers.utils.parseUnits("1000", 12);
        console.log(`  ${colors.cyan}Setting acceptablePrice to $1000 per TSLA share for short decrease${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.MarketDecrease, {
        sizeDeltaUsd,
        collateralAmount: collateralToWithdraw,
        isLong,
        acceptablePrice
    });
}

async function closePosition(signer, options) {
    const { side } = options;

    if (!side) {
        console.log(`${colors.red}Error: Missing SIDE option${colors.reset}`);
        return;
    }

    // Check position exists and get current size
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const isLong = side === 'long';

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, ADDRESSES.MARKET, ADDRESSES.mUSD, isLong]
        )
    );

    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);
    if (!positionExists) {
        console.log(`${colors.red}No ${side} position exists to close${colors.reset}`);
        return;
    }

    // Get current position size and collateral
    const sizeKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["SIZE_IN_USD"]))]
        )
    );
    const currentSize = await dataStore.getUint(sizeKey);

    const collateralKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [positionKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["COLLATERAL_AMOUNT"]))]
        )
    );
    const currentCollateral = await dataStore.getUint(collateralKey);

    console.log(`\n${colors.bright}Closing ${side.toUpperCase()} Position:${colors.reset}`);
    console.log(`  Position Size: ${colors.yellow}$${ethers.utils.formatUnits(currentSize, 30)}${colors.reset}`);
    console.log(`  Collateral: ${colors.green}${ethers.utils.formatUnits(currentCollateral, 6)} mUSD${colors.reset}`);

    // Set acceptablePrice based on position type
    let acceptablePrice = 0;
    if (isLong) {
        // For closing longs, use min acceptable price
        acceptablePrice = ethers.utils.parseUnits("300", 12);
        console.log(`  ${colors.cyan}Setting acceptablePrice to $300 per TSLA share for long close${colors.reset}`);
    } else {
        // For closing shorts, set max acceptable price
        acceptablePrice = ethers.utils.parseUnits("1000", 12);
        console.log(`  ${colors.cyan}Setting acceptablePrice to $1000 per TSLA share for short close${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.MarketDecrease, {
        sizeDeltaUsd: currentSize,
        collateralAmount: currentCollateral,
        isLong,
        acceptablePrice
    });
}

async function setPrice(signer, options) {
    const { price } = options;

    if (!price) {
        console.log(`${colors.red}Error: Missing required option for set-price${colors.reset}`);
        console.log("Required: PRICE=<usd_value>");
        return;
    }

    const mockProvider = await ethers.getContractAt(
        ["function setPriceWithPrecision(address token, uint256 price) external"],
        ADDRESSES.MOCK_PROVIDER
    );

    // Convert price to proper precision for mTSLA
    // mTSLA has 18 decimals, precision is 30
    // Price represents USD per TSLA share
    const priceWithPrecision = ethers.utils.parseUnits(price, 12); // 30 - 18 = 12

    console.log(`\n${colors.bright}Updating Oracle Price:${colors.reset}`);
    console.log(`  Token: ${colors.cyan}mTSLA${colors.reset}`);
    console.log(`  New Price: ${colors.green}$${price}${colors.reset}`);

    const tx = await mockProvider.setPriceWithPrecision(ADDRESSES.mTSLA, priceWithPrecision);
    console.log(`Transaction: ${colors.cyan}${tx.hash}${colors.reset}`);

    await tx.wait();
    console.log(`${colors.green}✅ Price updated!${colors.reset}`);
}

async function main() {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}=== TSLA/USD Market Trading ===${colors.reset}`);
    console.log(`${colors.bright}Signer:${colors.reset} ${colors.cyan}${signer.address}${colors.reset}`);

    // Check balances
    const musd = await ethers.getContractAt("IERC20", ADDRESSES.mUSD);
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const musdBalance = await musd.balanceOf(signer.address);

    console.log(`${colors.bright}Balances:${colors.reset}`);
    console.log(`  ETH: ${colors.yellow}${ethers.utils.formatEther(ethBalance)}${colors.reset}`);
    console.log(`  mUSD: ${colors.green}${ethers.utils.formatUnits(musdBalance, 6)}${colors.reset}`);

    const { action, options } = parseArgs();

    try {
        switch (action) {
            case 'check':
                await checkPosition(signer, options.side);
                break;
            case 'open':
                await openPosition(signer, options);
                break;
            case 'increase':
                await increasePosition(signer, options);
                break;
            case 'decrease':
                await decreasePosition(signer, options);
                break;
            case 'close':
                await closePosition(signer, options);
                break;
            case 'set-price':
                await setPrice(signer, options);
                break;
            case 'help':
            default:
                printUsage();
                break;
        }
    } catch (error) {
        console.log(`\n${colors.red}Error:${colors.reset} ${error.message}`);

        // Decode common errors
        if (error.error && error.error.data) {
            const errorData = error.error.data;
            const errors = {
                "0x3e237976": "UnexpectedOrderType",
                "0x7c2b27de": "InvalidOrderSizeDeltaUsd",
                "0x5c32d106": "EmptyDecrease",
                "0x3e0cf1c5": "InvalidDecreaseOrderSize",
                "0x0a66265f": "InvalidPositionMarket",
                "0x764a39dc": "InvalidCollateralTokenForMarket"
            };

            const selector = errorData.slice(0, 10);
            if (errors[selector]) {
                console.log(`Error type: ${colors.yellow}${errors[selector]}${colors.reset}`);
            }
        }
    }

    console.log(''); // Empty line at the end
}

main().catch(console.error);
