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
    EXCHANGE_ROUTER: "0x3B33708e9b8242999459EB9b4756C24c846e5936",
    ORDER_VAULT: "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F",
    ROUTER: "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc",
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    MARKET: "0x5E63276Caae0FF49b2762b98A1d37941AA50F804",  // Market 8: mNGN/mUSD/mNGN
    USDT: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",  // mUSD
    sNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827",  // mNGN
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
    Liquidation: 7,
    StopIncrease: 8
};

function printUsage() {
    console.log(`
${colors.bright}USAGE:${colors.reset}
  ACTION=<action> [OPTIONS] npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

${colors.bright}ACTIONS:${colors.reset}
  ${colors.cyan}check${colors.reset}              Check current position status

  ${colors.bright}Opening Positions:${colors.reset}
  ${colors.cyan}open${colors.reset}               Open position at market price
  ${colors.cyan}limit-open${colors.reset}         Open position with limit order (buy dip/sell rip)
  ${colors.cyan}stop-open${colors.reset}          Open position with stop order (buy breakout/sell breakdown)

  ${colors.bright}Managing Positions:${colors.reset}
  ${colors.cyan}increase${colors.reset}           Increase existing position at market price
  ${colors.cyan}decrease${colors.reset}           Decrease existing position at market price
  ${colors.cyan}close${colors.reset}              Close entire position at market price
  ${colors.cyan}set-tp${colors.reset}             Set take-profit order (limit decrease)
  ${colors.cyan}set-sl${colors.reset}             Set stop-loss order

  ${colors.bright}Other:${colors.reset}
  ${colors.cyan}set-price${colors.reset}          Update oracle prices

${colors.bright}OPTIONS (as environment variables):${colors.reset}
  SIDE=<long|short>         Position side (required for most actions)
  SIZE=<number>             Size in USD (required for open/increase)
  COLLATERAL=<number>       Collateral in USDT (required for open/increase)
  TRIGGER_PRICE=<number>    Trigger price in NGN per USDT (required for limit/stop orders)
  TP_PRICE=<number>         Take-profit price in NGN per USDT (optional for open/increase)
  SL_PRICE=<number>         Stop-loss price in NGN per USDT (optional for open/increase)
  PERCENT=<number>          Percentage to close (for decrease/set-tp/set-sl, default: 100)
  AMOUNT=<number>           Specific USD amount to decrease
  TOKEN=<USDT|sNGN>         Token for price update
  PRICE=<number>            New price in USD

${colors.bright}EXAMPLES:${colors.reset}
  # Check current positions
  ACTION=check npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  ${colors.bright}Market Orders:${colors.reset}
  # Open a long position at market
  ACTION=open SIDE=long SIZE=100 COLLATERAL=100 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  # Open a short position at market with TP and SL
  ACTION=open SIDE=short SIZE=50 COLLATERAL=50 TP_PRICE=4500 SL_PRICE=5500 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  ${colors.bright}Limit Orders (Entry):${colors.reset}
  # Open long when price dips to 4500 NGN per USDT with TP/SL
  ACTION=limit-open SIDE=long SIZE=100 COLLATERAL=100 TRIGGER_PRICE=4500 TP_PRICE=5000 SL_PRICE=4200 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  # Open short when price rips to 5500 NGN per USDT (no TP/SL)
  ACTION=limit-open SIDE=short SIZE=50 COLLATERAL=50 TRIGGER_PRICE=5500 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  ${colors.bright}Stop Orders (Entry):${colors.reset}
  # Open long on breakout above 5500 NGN per USDT with TP/SL
  ACTION=stop-open SIDE=long SIZE=100 COLLATERAL=100 TRIGGER_PRICE=5500 TP_PRICE=6000 SL_PRICE=5200 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  # Open short on breakdown below 4500 NGN per USDT (no TP/SL)
  ACTION=stop-open SIDE=short SIZE=50 COLLATERAL=50 TRIGGER_PRICE=4500 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  ${colors.bright}Take Profit & Stop Loss:${colors.reset}
  # Set take-profit at 5500 NGN per USDT (full position)
  ACTION=set-tp SIDE=long TRIGGER_PRICE=5500 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  # Set take-profit at 4500 NGN per USDT for 50% of position
  ACTION=set-tp SIDE=short TRIGGER_PRICE=4500 PERCENT=50 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  # Set stop-loss at 4500 NGN per USDT (full position)
  ACTION=set-sl SIDE=long TRIGGER_PRICE=4500 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  # Set stop-loss at 5500 NGN per USDT for $25
  ACTION=set-sl SIDE=short TRIGGER_PRICE=5500 AMOUNT=25 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  ${colors.bright}Position Management:${colors.reset}
  # Increase a position at market
  ACTION=increase SIDE=long SIZE=50 COLLATERAL=50 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  # Decrease 50% of position at market
  ACTION=decrease SIDE=long PERCENT=50 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  # Close entire position at market
  ACTION=close SIDE=long npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia

  ${colors.bright}Oracle:${colors.reset}
  # Update oracle price
  ACTION=set-price TOKEN=USDT PRICE=1.05 npx hardhat run scripts/test-market-orders.js --network arbitrumSepolia
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
        token: process.env.TOKEN,
        price: process.env.PRICE,
        triggerPrice: process.env.TRIGGER_PRICE,
        tpPrice: process.env.TP_PRICE,
        slPrice: process.env.SL_PRICE
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

    // Check both long and short if side not specified
    const sidesToCheck = side ? [side] : ['long', 'short'];

    for (const checkSide of sidesToCheck) {
        const isLong = checkSide === 'long';

        const positionKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address", "bool"],
                [account, ADDRESSES.MARKET, ADDRESSES.USDT, isLong]
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
            console.log(`  Collateral: ${colors.yellow}${ethers.utils.formatUnits(collateralAmount, 6)} USDT${colors.reset}`);

            // Calculate leverage
            if (collateralAmount.gt(0)) {
                const leverage = sizeInUsd.div(collateralAmount.mul(ethers.utils.parseUnits("1", 24)));
                console.log(`  Leverage: ${colors.magenta}${leverage.toString()}x${colors.reset}`);
            }
        } else {
            console.log(`\n${colors.bright}${checkSide.toUpperCase()} Position:${colors.reset} ${colors.red}No position${colors.reset}`);
        }
    }

    return true;
}

async function createOrder(signer, orderType, orderParams) {
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);

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

    // 2. For increase orders, approve and send USDT
    const isIncreaseOrder = [OrderTypes.MarketIncrease, OrderTypes.LimitIncrease, OrderTypes.StopIncrease].includes(orderType);
    if (isIncreaseOrder && orderParams.collateralAmount) {
        // Check and approve USDT (one-time large approval)
        const allowance = await usdt.allowance(signer.address, ADDRESSES.ROUTER);
        const largeApproval = ethers.utils.parseUnits("1000000", 6); // 1M USDT
        if (allowance.lt(orderParams.collateralAmount)) {
            console.log(`  ${colors.yellow}Approving 1M USDT (one-time)...${colors.reset}`);
            await (await usdt.approve(ADDRESSES.ROUTER, 0)).wait();
            await (await usdt.approve(ADDRESSES.ROUTER, largeApproval)).wait();
        }

        multicallData.push(
            exchangeRouter.interface.encodeFunctionData("sendTokens", [
                ADDRESSES.USDT,
                ADDRESSES.ORDER_VAULT,
                orderParams.collateralAmount
            ])
        );
    }

    // 3. Create order
    // For decrease orders with short positions, we need to swap PnL token to collateral token
    let decreasePositionSwapType = 0; // NoSwap by default
    const isDecreaseOrder = [OrderTypes.MarketDecrease, OrderTypes.LimitDecrease, OrderTypes.StopLossDecrease].includes(orderType);
    if (isDecreaseOrder && !orderParams.isLong) {
        // For short positions, swap sNGN (PnL token) to USDT (collateral token)
        decreasePositionSwapType = 1; // SwapPnlTokenToCollateralToken
    }

    const createOrderParams = {
        addresses: {
            receiver: signer.address,
            cancellationReceiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialCollateralToken: ADDRESSES.USDT,
            swapPath: []
        },
        numbers: {
            sizeDeltaUsd: orderParams.sizeDeltaUsd,
            initialCollateralDeltaAmount: orderParams.collateralAmount || 0,
            triggerPrice: orderParams.triggerPrice || 0,
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

async function setTPSLIfProvided(signer, options) {
    const { side, tpPrice, slPrice } = options;

    if (!tpPrice && !slPrice) {
        return; // Nothing to do
    }

    const isLong = side === 'long';

    // Check if position exists before setting TP/SL
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, ADDRESSES.MARKET, ADDRESSES.USDT, isLong]
        )
    );

    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    // Poll for position to exist (wait up to 30 seconds)
    console.log(`\n${colors.yellow}Waiting for position to be created...${colors.reset}`);
    let positionExists = false;
    for (let i = 0; i < 30; i++) {
        positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);
        if (positionExists) {
            console.log(`${colors.green}✅ Position created!${colors.reset}`);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        process.stdout.write('.');
    }

    if (!positionExists) {
        console.log(`\n${colors.red}Position not created within 30 seconds. TP/SL orders not set.${colors.reset}`);
        return;
    }

    // Get position size and collateral for TP/SL orders
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

    // Set Take Profit if provided
    if (tpPrice) {
        console.log(`\n${colors.bright}Setting Take-Profit at ${tpPrice} NGN per USDT...${colors.reset}`);
        const triggerPriceFormatted = ethers.utils.parseUnits(tpPrice, 24);

        let acceptablePrice;
        if (isLong) {
            acceptablePrice = 0;
        } else {
            acceptablePrice = triggerPriceFormatted;
        }

        await createOrder(signer, OrderTypes.LimitDecrease, {
            sizeDeltaUsd: currentSize,
            collateralAmount: currentCollateral,
            isLong,
            triggerPrice: triggerPriceFormatted,
            acceptablePrice
        });
    }

    // Set Stop Loss if provided
    if (slPrice) {
        console.log(`\n${colors.bright}Setting Stop-Loss at ${slPrice} NGN per USDT...${colors.reset}`);
        const triggerPriceFormatted = ethers.utils.parseUnits(slPrice, 24);

        let acceptablePrice;
        if (isLong) {
            acceptablePrice = 0;
        } else {
            acceptablePrice = triggerPriceFormatted;
        }

        await createOrder(signer, OrderTypes.StopLossDecrease, {
            sizeDeltaUsd: currentSize,
            collateralAmount: currentCollateral,
            isLong,
            triggerPrice: triggerPriceFormatted,
            acceptablePrice
        });
    }
}

async function openPosition(signer, options) {
    const { side, size, collateral } = options;

    if (!side || !size || !collateral) {
        console.log(`${colors.red}Error: Missing required options for open position${colors.reset}`);
        console.log("Required: --side <long|short> --size <number> --collateral <number>");
        return;
    }

    const isLong = side === 'long';
    const sizeDeltaUsd = ethers.utils.parseUnits(size, 30);
    const collateralAmount = ethers.utils.parseUnits(collateral, 6);

    console.log(`\n${colors.bright}Opening ${side.toUpperCase()} Position:${colors.reset}`);
    console.log(`  Size: ${colors.green}$${size}${colors.reset}`);
    console.log(`  Collateral: ${colors.yellow}${collateral} USDT${colors.reset}`);
    console.log(`  Leverage: ${colors.magenta}${(size / collateral).toFixed(1)}x${colors.reset}`);

    // Set acceptablePrice for position opens
    let acceptablePrice = 0;
    if (isLong) {
        // For opening longs, use 5000 NGN per USDT (with exchange rate pricing)
        acceptablePrice = ethers.utils.parseUnits("5000", 24); // 5000 with 24 decimals (30 - 6 for USDT)
        console.log(`  ${colors.cyan}Setting acceptablePrice to 5000 NGN per USDT for long open${colors.reset}`);
    } else {
        // For opening shorts, use 0 (like create-flexible-order.js)
        acceptablePrice = ethers.utils.parseUnits("0", 24); // 5000 with 24 decimals (30 - 6 for USDT);
        console.log(`  ${colors.cyan}Setting acceptablePrice to 0 for short open${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.MarketIncrease, {
        sizeDeltaUsd,
        collateralAmount,
        isLong,
        acceptablePrice
    });

    // Set TP/SL if provided
    await setTPSLIfProvided(signer, options);
}

async function increasePosition(signer, options) {
    const { side, size, collateral } = options;

    if (!side || !size || !collateral) {
        console.log(`${colors.red}Error: Missing required options for increase position${colors.reset}`);
        console.log("Required: --side <long|short> --size <number> --collateral <number>");
        return;
    }

    // Check if position exists
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const isLong = side === 'long';

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, ADDRESSES.MARKET, ADDRESSES.USDT, isLong]
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

    const sizeDeltaUsd = ethers.utils.parseUnits(size, 30);
    const collateralAmount = ethers.utils.parseUnits(collateral, 6);

    console.log(`\n${colors.bright}Increasing ${side.toUpperCase()} Position:${colors.reset}`);
    console.log(`  Additional Size: ${colors.green}$${size}${colors.reset}`);
    console.log(`  Additional Collateral: ${colors.yellow}${collateral} USDT${colors.reset}`);

    // Set acceptablePrice for position increases
    let acceptablePrice = 0;
    if (isLong) {
        // For increasing longs, use 5000 NGN per USDT (same as long open)
        acceptablePrice = ethers.utils.parseUnits("5000", 24); // 5000 with 24 decimals (30 - 6 for USDT)
        console.log(`  ${colors.cyan}Setting acceptablePrice to 5000 NGN per USDT for long increase${colors.reset}`);
    } else {
        // For increasing shorts, use 0
        acceptablePrice = 0;
        console.log(`  ${colors.cyan}Setting acceptablePrice to 0 for short increase${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.MarketIncrease, {
        sizeDeltaUsd,
        collateralAmount,
        isLong,
        acceptablePrice
    });

    // Set TP/SL if provided (only if position was just created, not increased)
    await setTPSLIfProvided(signer, options);
}

async function decreasePosition(signer, options) {
    const { side, percent, amount } = options;

    if (!side) {
        console.log(`${colors.red}Error: Missing --side option${colors.reset}`);
        return;
    }

    // Check position exists and get current size
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const isLong = side === 'long';

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, ADDRESSES.MARKET, ADDRESSES.USDT, isLong]
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

    console.log(`  Collateral to Withdraw: ${colors.green}${ethers.utils.formatUnits(collateralToWithdraw, 6)} USDT${colors.reset}`);

    // Set acceptablePrice based on position type
    let acceptablePrice = 0;
    if (isLong) {
        // For decreasing longs, use 0
        acceptablePrice = 0;
        console.log(`  ${colors.cyan}Setting acceptablePrice to 0 for long decrease${colors.reset}`);
    } else {
        console.log(`  ${colors.cyan}Note: Using swap for SHORT position (sNGN → USDT)${colors.reset}`);
        // For decreasing shorts, acceptablePrice is the max price we'll accept
        acceptablePrice = ethers.utils.parseUnits("5000", 24); // 5000 NGN per USDT with 24 decimals (30 - 6 for USDT)
        console.log(`  ${colors.cyan}Setting acceptablePrice to 5000 NGN per USDT for short decrease${colors.reset}`);
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
        console.log(`${colors.red}Error: Missing --side option${colors.reset}`);
        return;
    }

    // Check position exists and get current size
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const isLong = side === 'long';

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, ADDRESSES.MARKET, ADDRESSES.USDT, isLong]
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
    console.log(`  Collateral: ${colors.green}${ethers.utils.formatUnits(currentCollateral, 6)} USDT${colors.reset}`);

    // Set acceptablePrice based on position type
    let acceptablePrice = 0;
    if (isLong) {
        // For closing longs, use 0
        acceptablePrice = 0;
        console.log(`  ${colors.cyan}Setting acceptablePrice to 0 for long close${colors.reset}`);
    } else {
        console.log(`  ${colors.cyan}Note: Using swap for SHORT position (sNGN → USDT)${colors.reset}`);
        // For closing shorts, acceptablePrice is the max price we'll accept
        acceptablePrice = ethers.utils.parseUnits("5000", 24); // 5000 NGN per USDT with 24 decimals (30 - 6 for USDT)
        console.log(`  ${colors.cyan}Setting acceptablePrice to 5000 NGN per USDT for short close${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.MarketDecrease, {
        sizeDeltaUsd: currentSize,
        collateralAmount: currentCollateral,
        isLong,
        acceptablePrice
    });
}

async function setPrice(signer, options) {
    const { token, price } = options;

    if (!token || !price) {
        console.log(`${colors.red}Error: Missing required options for set-price${colors.reset}`);
        console.log("Required: --token <USDT|sNGN> --price <number>");
        return;
    }

    const mockProvider = await ethers.getContractAt(
        ["function setPriceWithPrecision(address token, uint256 price) external"],
        ADDRESSES.MOCK_PROVIDER
    );

    const tokenAddress = token.toUpperCase() === 'USDT' ? ADDRESSES.USDT : ADDRESSES.sNGN;

    // Convert price to proper precision
    let priceWithPrecision;
    if (token.toUpperCase() === 'USDT') {
        // USDT has 6 decimals, precision is 30
        priceWithPrecision = ethers.utils.parseUnits(price, 24); // 30 - 6 = 24
    } else {
        // sNGN has 18 decimals, precision is 30
        priceWithPrecision = ethers.utils.parseUnits(price, 12); // 30 - 18 = 12
    }

    console.log(`\n${colors.bright}Updating Oracle Price:${colors.reset}`);
    console.log(`  Token: ${colors.cyan}${token}${colors.reset}`);
    console.log(`  New Price: ${colors.green}$${price}${colors.reset}`);

    const tx = await mockProvider.setPriceWithPrecision(tokenAddress, priceWithPrecision);
    console.log(`Transaction: ${colors.cyan}${tx.hash}${colors.reset}`);

    await tx.wait();
    console.log(`${colors.green}✅ Price updated!${colors.reset}`);
}

async function limitOpenPosition(signer, options) {
    const { side, size, collateral, triggerPrice } = options;

    if (!side || !size || !collateral || !triggerPrice) {
        console.log(`${colors.red}Error: Missing required options for limit-open${colors.reset}`);
        console.log("Required: SIDE=<long|short> SIZE=<number> COLLATERAL=<number> TRIGGER_PRICE=<number>");
        return;
    }

    const isLong = side === 'long';
    const sizeDeltaUsd = ethers.utils.parseUnits(size, 30);
    const collateralAmount = ethers.utils.parseUnits(collateral, 6);
    const triggerPriceFormatted = ethers.utils.parseUnits(triggerPrice, 24); // 30 - 6 decimals for USDT

    console.log(`\n${colors.bright}Opening ${side.toUpperCase()} Position (Limit Order):${colors.reset}`);
    console.log(`  Size: ${colors.green}$${size}${colors.reset}`);
    console.log(`  Collateral: ${colors.yellow}${collateral} USDT${colors.reset}`);
    console.log(`  Leverage: ${colors.magenta}${(size / collateral).toFixed(1)}x${colors.reset}`);
    console.log(`  Trigger Price: ${colors.cyan}${triggerPrice} NGN per USDT${colors.reset}`);

    // Set acceptablePrice based on side
    let acceptablePrice;
    if (isLong) {
        // For limit longs, we want to buy when price goes down
        // acceptablePrice should be lower than trigger (worst acceptable price)
        acceptablePrice = triggerPriceFormatted;
        console.log(`  ${colors.cyan}Acceptable Price: ${triggerPrice} NGN per USDT (buy on dip)${colors.reset}`);
    } else {
        // For limit shorts, we want to sell when price goes up
        // acceptablePrice should be higher than trigger
        acceptablePrice = triggerPriceFormatted;
        console.log(`  ${colors.cyan}Acceptable Price: ${triggerPrice} NGN per USDT (sell on rip)${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.LimitIncrease, {
        sizeDeltaUsd,
        collateralAmount,
        isLong,
        triggerPrice: triggerPriceFormatted,
        acceptablePrice
    });

    // Set TP/SL if provided
    await setTPSLIfProvided(signer, options);
}

async function stopOpenPosition(signer, options) {
    const { side, size, collateral, triggerPrice } = options;

    if (!side || !size || !collateral || !triggerPrice) {
        console.log(`${colors.red}Error: Missing required options for stop-open${colors.reset}`);
        console.log("Required: SIDE=<long|short> SIZE=<number> COLLATERAL=<number> TRIGGER_PRICE=<number>");
        return;
    }

    const isLong = side === 'long';
    const sizeDeltaUsd = ethers.utils.parseUnits(size, 30);
    const collateralAmount = ethers.utils.parseUnits(collateral, 6);
    const triggerPriceFormatted = ethers.utils.parseUnits(triggerPrice, 24); // 30 - 6 decimals for USDT

    console.log(`\n${colors.bright}Opening ${side.toUpperCase()} Position (Stop Order):${colors.reset}`);
    console.log(`  Size: ${colors.green}$${size}${colors.reset}`);
    console.log(`  Collateral: ${colors.yellow}${collateral} USDT${colors.reset}`);
    console.log(`  Leverage: ${colors.magenta}${(size / collateral).toFixed(1)}x${colors.reset}`);
    console.log(`  Trigger Price: ${colors.cyan}${triggerPrice} NGN per USDT${colors.reset}`);

    // Set acceptablePrice based on side
    let acceptablePrice;
    if (isLong) {
        // For stop longs, we want to buy when price breaks up
        // acceptablePrice should be higher (allow slippage up)
        acceptablePrice = ethers.utils.parseUnits((parseFloat(triggerPrice) * 1.01).toString(), 24); // 1% slippage
        console.log(`  ${colors.cyan}Acceptable Price: ${(parseFloat(triggerPrice) * 1.01).toFixed(2)} NGN per USDT (buy breakout)${colors.reset}`);
    } else {
        // For stop shorts, we want to sell when price breaks down
        // acceptablePrice should be lower (allow slippage down)
        acceptablePrice = ethers.utils.parseUnits((parseFloat(triggerPrice) * 0.99).toString(), 24); // 1% slippage
        console.log(`  ${colors.cyan}Acceptable Price: ${(parseFloat(triggerPrice) * 0.99).toFixed(2)} NGN per USDT (sell breakdown)${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.StopIncrease, {
        sizeDeltaUsd,
        collateralAmount,
        isLong,
        triggerPrice: triggerPriceFormatted,
        acceptablePrice
    });

    // Set TP/SL if provided
    await setTPSLIfProvided(signer, options);
}

async function setTakeProfit(signer, options) {
    const { side, triggerPrice, percent, amount } = options;

    if (!side || !triggerPrice) {
        console.log(`${colors.red}Error: Missing required options for set-tp${colors.reset}`);
        console.log("Required: SIDE=<long|short> TRIGGER_PRICE=<number>");
        console.log("Optional: PERCENT=<number> or AMOUNT=<number> (default: 100% - full close)");
        return;
    }

    // Check position exists and get current size
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const isLong = side === 'long';

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, ADDRESSES.MARKET, ADDRESSES.USDT, isLong]
        )
    );

    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);
    if (!positionExists) {
        console.log(`${colors.red}No ${side} position exists to set take-profit${colors.reset}`);
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

    let sizeDeltaUsd;
    let collateralToWithdraw;
    if (percent) {
        sizeDeltaUsd = currentSize.mul(percent).div(100);
        collateralToWithdraw = currentCollateral.mul(percent).div(100);
        console.log(`\n${colors.bright}Setting Take-Profit for ${side.toUpperCase()} (${percent}%):${colors.reset}`);
    } else if (amount) {
        sizeDeltaUsd = ethers.utils.parseUnits(amount, 30);
        collateralToWithdraw = currentCollateral.mul(sizeDeltaUsd).div(currentSize);
        console.log(`\n${colors.bright}Setting Take-Profit for ${side.toUpperCase()} ($${amount}):${colors.reset}`);
    } else {
        // Default to full close
        sizeDeltaUsd = currentSize;
        collateralToWithdraw = currentCollateral;
        console.log(`\n${colors.bright}Setting Take-Profit for ${side.toUpperCase()} (Full Close):${colors.reset}`);
    }

    console.log(`  Current Size: ${colors.yellow}$${ethers.utils.formatUnits(currentSize, 30)}${colors.reset}`);
    console.log(`  TP Size: ${colors.green}$${ethers.utils.formatUnits(sizeDeltaUsd, 30)}${colors.reset}`);
    console.log(`  Trigger Price: ${colors.cyan}${triggerPrice} NGN per USDT${colors.reset}`);

    const triggerPriceFormatted = ethers.utils.parseUnits(triggerPrice, 24);

    // Set acceptablePrice based on position type
    let acceptablePrice;
    if (isLong) {
        // For long TP, we want to sell when price goes up, acceptable price is trigger or lower
        acceptablePrice = 0; // Accept any price
        console.log(`  ${colors.cyan}Setting acceptablePrice to 0 for long TP${colors.reset}`);
    } else {
        console.log(`  ${colors.cyan}Note: Using swap for SHORT position (sNGN → USDT)${colors.reset}`);
        // For short TP, we want to buy back when price goes down
        acceptablePrice = triggerPriceFormatted;
        console.log(`  ${colors.cyan}Setting acceptablePrice to ${triggerPrice} NGN per USDT for short TP${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.LimitDecrease, {
        sizeDeltaUsd,
        collateralAmount: collateralToWithdraw,
        isLong,
        triggerPrice: triggerPriceFormatted,
        acceptablePrice
    });
}

async function setStopLoss(signer, options) {
    const { side, triggerPrice, percent, amount } = options;

    if (!side || !triggerPrice) {
        console.log(`${colors.red}Error: Missing required options for set-sl${colors.reset}`);
        console.log("Required: SIDE=<long|short> TRIGGER_PRICE=<number>");
        console.log("Optional: PERCENT=<number> or AMOUNT=<number> (default: 100% - full close)");
        return;
    }

    // Check position exists and get current size
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const isLong = side === 'long';

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, ADDRESSES.MARKET, ADDRESSES.USDT, isLong]
        )
    );

    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);
    if (!positionExists) {
        console.log(`${colors.red}No ${side} position exists to set stop-loss${colors.reset}`);
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

    let sizeDeltaUsd;
    let collateralToWithdraw;
    if (percent) {
        sizeDeltaUsd = currentSize.mul(percent).div(100);
        collateralToWithdraw = currentCollateral.mul(percent).div(100);
        console.log(`\n${colors.bright}Setting Stop-Loss for ${side.toUpperCase()} (${percent}%):${colors.reset}`);
    } else if (amount) {
        sizeDeltaUsd = ethers.utils.parseUnits(amount, 30);
        collateralToWithdraw = currentCollateral.mul(sizeDeltaUsd).div(currentSize);
        console.log(`\n${colors.bright}Setting Stop-Loss for ${side.toUpperCase()} ($${amount}):${colors.reset}`);
    } else {
        // Default to full close
        sizeDeltaUsd = currentSize;
        collateralToWithdraw = currentCollateral;
        console.log(`\n${colors.bright}Setting Stop-Loss for ${side.toUpperCase()} (Full Close):${colors.reset}`);
    }

    console.log(`  Current Size: ${colors.yellow}$${ethers.utils.formatUnits(currentSize, 30)}${colors.reset}`);
    console.log(`  SL Size: ${colors.red}$${ethers.utils.formatUnits(sizeDeltaUsd, 30)}${colors.reset}`);
    console.log(`  Trigger Price: ${colors.cyan}${triggerPrice} NGN per USDT${colors.reset}`);

    const triggerPriceFormatted = ethers.utils.parseUnits(triggerPrice, 24);

    // Set acceptablePrice based on position type
    let acceptablePrice;
    if (isLong) {
        // For long SL, we want to sell when price goes down, acceptable price is 0 (any price)
        acceptablePrice = 0;
        console.log(`  ${colors.cyan}Setting acceptablePrice to 0 for long SL${colors.reset}`);
    } else {
        console.log(`  ${colors.cyan}Note: Using swap for SHORT position (sNGN → USDT)${colors.reset}`);
        // For short SL, we want to buy back when price goes up, set max acceptable price
        acceptablePrice = triggerPriceFormatted;
        console.log(`  ${colors.cyan}Setting acceptablePrice to ${triggerPrice} NGN per USDT for short SL${colors.reset}`);
    }

    await createOrder(signer, OrderTypes.StopLossDecrease, {
        sizeDeltaUsd,
        collateralAmount: collateralToWithdraw,
        isLong,
        triggerPrice: triggerPriceFormatted,
        acceptablePrice
    });
}

async function main() {
    const [signer] = await ethers.getSigners();

    console.log(`\n${colors.bright}Signer:${colors.reset} ${colors.cyan}${signer.address}${colors.reset}`);

    // Check balances
    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const usdtBalance = await usdt.balanceOf(signer.address);

    console.log(`${colors.bright}Balances:${colors.reset}`);
    console.log(`  ETH: ${colors.yellow}${ethers.utils.formatEther(ethBalance)}${colors.reset}`);
    console.log(`  USDT: ${colors.green}${ethers.utils.formatUnits(usdtBalance, 6)}${colors.reset}`);

    const { action, options } = parseArgs();

    try {
        switch (action) {
            case 'check':
                await checkPosition(signer, options.side);
                break;
            case 'open':
                await openPosition(signer, options);
                break;
            case 'limit-open':
                await limitOpenPosition(signer, options);
                break;
            case 'stop-open':
                await stopOpenPosition(signer, options);
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
            case 'set-tp':
                await setTakeProfit(signer, options);
                break;
            case 'set-sl':
                await setStopLoss(signer, options);
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
                "0x3e0cf1c5": "InvalidDecreaseOrderSize"
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