const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    // ============================================
    // CONFIGURATION - CHANGE THESE AS NEEDED
    // ============================================
    const ORDER_CONFIG = {
        type: "increase",  // "increase" or "decrease"
        size: "100",         // Position size in USD (for increase) or size to decrease (for decrease)
        collateral: "100",   // USDT amount (for increase only, ignored for decrease)
        isLong: true       // true for long, false for short
    };
    // ============================================

    console.log("=== Creating Flexible Order ===\n");
    console.log("Configuration:");
    console.log("  Type:", ORDER_CONFIG.type.toUpperCase());
    console.log("  Size:", ORDER_CONFIG.size, "USD");
    if (ORDER_CONFIG.type === "increase") {
        console.log("  Collateral:", ORDER_CONFIG.collateral, "USDT");
    }
    console.log("  Direction:", ORDER_CONFIG.isLong ? "LONG" : "SHORT");
    console.log("\nSigner address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const ORDER_VAULT = "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F";
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    // Market and tokens
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    console.log("\n📍 Market:", MARKET);
    console.log("   USDT:", USDT);
    console.log("   sNGN:", sNGN);

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Get WNT for execution fee
    const WNT_KEY = ethers.utils.id("WNT");
    const WNT = await dataStore.getAddress(WNT_KEY);
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"
        : WNT;

    // Calculate amounts based on order type
    const sizeDeltaUsd = ethers.utils.parseUnits(ORDER_CONFIG.size, 30);
    const executionFee = ethers.utils.parseEther("0.001");

    let orderAmount;
    if (ORDER_CONFIG.type === "increase") {
        orderAmount = ethers.utils.parseUnits(ORDER_CONFIG.collateral, 6); // USDT has 6 decimals
    } else {
        // For decrease, withdraw the same amount of USDT as USD size decrease
        orderAmount = ethers.utils.parseUnits(ORDER_CONFIG.size, 6); // Withdraw matching USDT amount
    }

    console.log("\n📊 Order Details:");
    console.log("  Order Type:", ORDER_CONFIG.type === "increase" ? "Market Increase" : "Market Decrease");
    if (ORDER_CONFIG.type === "increase") {
        console.log("  Collateral Amount:", ORDER_CONFIG.collateral, "USDT");
    } else {
        console.log("  Collateral to Withdraw:", ORDER_CONFIG.size, "USDT");
    }
    console.log("  Size Delta:", ORDER_CONFIG.size, "USD");
    console.log("  Execution Fee: 0.001 ETH");

    // Check balances
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const usdtBalance = await usdt.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  ETH:", ethers.utils.formatEther(ethBalance));
    console.log("  USDT:", ethers.utils.formatUnits(usdtBalance, 6));

    if (ethBalance.lt(executionFee)) {
        console.log("❌ Insufficient ETH for execution fee");
        return;
    }

    // Only check USDT balance for increase orders
    if (ORDER_CONFIG.type === "increase" && usdtBalance.lt(orderAmount)) {
        console.log("❌ Insufficient USDT for collateral");
        return;
    }

    // For decrease orders, check if position exists
    if (ORDER_CONFIG.type === "decrease") {
        console.log("\n📍 Checking existing position...");

        const positionKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address", "bool"],
                [signer.address, MARKET, USDT, ORDER_CONFIG.isLong]
            )
        );

        const POSITION_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
        );

        const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);
        if (!positionExists) {
            console.log("❌ No position to decrease. Create an increase order first.");
            return;
        }
        console.log("  ✅ Position exists");
    }

    // Build multicall
    console.log("\n📍 Building order transaction...");
    const multicallData = [];

    // 1. Send execution fee (WNT)
    const sendWntData = exchangeRouter.interface.encodeFunctionData("sendWnt", [
        ORDER_VAULT,
        executionFee
    ]);
    multicallData.push(sendWntData);

    // 2. For increase orders only: approve and send USDT
    if (ORDER_CONFIG.type === "increase") {
        // Approve USDT
        console.log("  Checking USDT approval...");
        const allowance = await usdt.allowance(signer.address, ROUTER);
        if (allowance.lt(orderAmount)) {
            // Reset approval to 0 first (some tokens require this)
            let tx = await usdt.approve(ROUTER, 0);
            await tx.wait();

            // Then approve exact amount
            tx = await usdt.approve(ROUTER, orderAmount);
            await tx.wait();
            console.log("  ✅ USDT approved for exact amount");
        } else {
            console.log("  ✅ USDT already approved");
        }

        // Send USDT collateral
        const sendTokensData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
            USDT,
            ORDER_VAULT,
            orderAmount
        ]);
        multicallData.push(sendTokensData);
    }

    // 3. Create the order
    const orderType = ORDER_CONFIG.type === "increase" ? 2 : 4; // MarketIncrease : MarketDecrease

    const orderParams = {
        addresses: {
            receiver: signer.address,
            cancellationReceiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialCollateralToken: USDT,
            swapPath: []
        },
        numbers: {
            sizeDeltaUsd: sizeDeltaUsd,
            initialCollateralDeltaAmount: orderAmount, // For decrease, this is the amount to withdraw
            triggerPrice: 0,
            acceptablePrice: 0, // No price restriction
            executionFee: executionFee,
            callbackGasLimit: 0,
            minOutputAmount: 0,
            validFromTime: 0
        },
        orderType: orderType,
        decreasePositionSwapType: ORDER_CONFIG.type === "decrease" ? 0 : 0, // NoSwap for both
        isLong: ORDER_CONFIG.isLong,
        shouldUnwrapNativeToken: false,
        autoCancel: false,
        referralCode: ethers.constants.HashZero,
        dataList: []
    };

    const createOrderData = exchangeRouter.interface.encodeFunctionData("createOrder", [
        orderParams
    ]);
    multicallData.push(createOrderData);

    // Execute multicall
    console.log("\n📍 Creating order...");

    try {
        const tx = await exchangeRouter.multicall(multicallData, {
            value: executionFee,
            gasLimit: 3000000
        });

        console.log("\n  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ Order created successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Try to find order key from events
        let orderKey = null;
        const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
        const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
        const ORDER_CREATED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCreated"));

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase() &&
                log.topics[0] === EVENT_LOG2_SIG &&
                log.topics[1] === ORDER_CREATED_HASH) {
                orderKey = log.topics[2];
                console.log("\n🔑 ORDER KEY:", orderKey);
                break;
            }
        }

        console.log("\n🎯 Order created! Your keeper should pick it up and execute it.");
        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("\n❌ Error creating order:", error.message);

        // Decode error if possible
        if (error.error && error.error.data) {
            const errorData = error.error.data;
            console.log("Error data:", errorData);

            // Common error selectors
            const errors = {
                "0x3e237976": "UnexpectedOrderType",
                "0x7c2b27de": "InvalidOrderSizeDeltaUsd",
                "0x5c32d106": "EmptyDecrease",
                "0x3e0cf1c5": "InvalidDecreaseOrderSize",
                "0xfb5d773c": "UnableToGetOppositeToken"
            };

            const selector = errorData.slice(0, 10);
            if (errors[selector]) {
                console.log("Error type:", errors[selector]);
            }
        }
    }
}

main().catch(console.error);