const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Test SHORT Order for COP Market ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const ORDER_VAULT = "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F";
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";

    // Market and tokens
    const MARKET = "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44"; // Market 15: mCOP/mUSD/mUSD
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const mCOP = "0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8";

    console.log("📍 Market 15 (COP):", MARKET);
    console.log("   Index Token: mCOP");
    console.log("   Long Token: mUSD");
    console.log("   Short Token: mUSD (single-token market)\n");

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const musd = await ethers.getContractAt("IERC20", mUSD);

    // Get WNT for execution fee
    const WNT_KEY = ethers.utils.id("WNT");
    const WNT = await dataStore.getAddress(WNT_KEY);
    const WETH = WNT === ethers.constants.AddressZero
        ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"
        : WNT;

    // Order parameters - SHORT position on COP
    // Collateral: 100 mUSD (6 decimals)
    // Position size: $1,000 USD (100 mUSD * 10x leverage)
    // This creates a 10x leverage SHORT position for testing
    const collateralAmount = ethers.utils.parseUnits("100", 6); // 100 mUSD collateral
    const sizeDeltaUsd = ethers.utils.parseUnits("1000", 30); // $1,000 position size (10x leverage)
    const executionFee = ethers.utils.parseEther("0.001"); // 0.001 ETH

    console.log("📊 Order Configuration:");
    console.log("  Type: Market Increase (SHORT COP) 📉");
    console.log("  Collateral: 100 mUSD");
    console.log("  Position Size: $1,000");
    console.log("  Index Token: mCOP (at 3,865.50 COP per USDT)");
    console.log("  Leverage: 10x");
    console.log("  Execution Fee: 0.001 ETH");

    // Check balances
    const ethBalance = await ethers.provider.getBalance(signer.address);
    const musdBalance = await musd.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  ETH:", ethers.utils.formatEther(ethBalance));
    console.log("  mUSD:", ethers.utils.formatUnits(musdBalance, 6));

    if (ethBalance.lt(executionFee)) {
        console.log("❌ Insufficient ETH for execution fee");
        return;
    }
    if (musdBalance.lt(collateralAmount)) {
        console.log("❌ Insufficient mUSD (need 100 mUSD)");
        return;
    }

    // Step 1: Approve mUSD to Router
    console.log("\n📍 Step 1: Approve Router for mUSD");
    const allowance = await musd.allowance(signer.address, ROUTER);
    if (allowance.lt(collateralAmount)) {
        const tx = await musd.approve(ROUTER, collateralAmount);
        await tx.wait();
        console.log("  ✅ mUSD approved");
    } else {
        console.log("  ✅ mUSD already approved");
    }

    // Step 2: Build multicall for order creation
    console.log("\n📍 Step 2: Building order creation multicall");
    console.log("  1. sendWnt - Send execution fee");
    console.log("  2. sendTokens - Send mUSD collateral");
    console.log("  3. createOrder - Create market increase order (SHORT)");

    const multicallData = [];

    // 1. Send execution fee (WNT)
    const sendWntData = exchangeRouter.interface.encodeFunctionData("sendWnt", [
        ORDER_VAULT,
        executionFee
    ]);
    multicallData.push(sendWntData);

    // 2. Send mUSD collateral
    const sendTokensData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        mUSD,
        ORDER_VAULT,
        collateralAmount
    ]);
    multicallData.push(sendTokensData);

    // 3. Create market increase order (SHORT COP)
    const orderParams = {
        addresses: {
            receiver: signer.address,
            cancellationReceiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialCollateralToken: mUSD,
            swapPath: []
        },
        numbers: {
            sizeDeltaUsd: sizeDeltaUsd,
            initialCollateralDeltaAmount: collateralAmount,
            triggerPrice: 0, // Not needed for market order
            acceptablePrice: 0, // For shorts, 0 means accept any price (or set a min acceptable price if you want protection)
            executionFee: executionFee,
            callbackGasLimit: 0,
            minOutputAmount: 0,
            validFromTime: 0
        },
        orderType: 2, // MarketIncrease
        decreasePositionSwapType: 0, // NoSwap
        isLong: false, // SHORT COP position
        shouldUnwrapNativeToken: false,
        autoCancel: false,
        referralCode: ethers.constants.HashZero,
        dataList: []
    };

    const createOrderData = exchangeRouter.interface.encodeFunctionData("createOrder", [
        orderParams
    ]);
    multicallData.push(createOrderData);

    // Step 3: Execute multicall
    console.log("\n📍 Step 3: Creating SHORT order...");

    try {
        const tx = await exchangeRouter.multicall(multicallData, {
            value: executionFee,
            gasLimit: 3000000
        });

        console.log("\n  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ SHORT Order created successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Find order key from events
        const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
        const ORDER_CREATED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCreated"));

        let orderKey = null;
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase() &&
                log.topics[0] === EVENT_LOG2_SIG &&
                log.topics[1] === ORDER_CREATED_HASH) {
                orderKey = log.topics[2];
                break;
            }
        }

        if (orderKey) {
            console.log("\n🔑 SHORT ORDER KEY:", orderKey);

            // Save to file
            const fs = require("fs");
            fs.writeFileSync("latest-order-key-cop-short.txt", orderKey);
            console.log("📝 Saved order key to: latest-order-key-cop-short.txt");
        }

        console.log("\n🎯 SHORT Order created! Your keeper should now:");
        console.log("  1. Detect the OrderCreated event");
        console.log("  2. Execute the order via OrderHandler.executeOrder()");
        console.log("  3. Use MockOracleProvider for price data (mCOP at 3865.50)");
        console.log("  4. This will open a SHORT position - profits if COP price goes DOWN");

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("\n❌ Error creating SHORT order:", error.message);
        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);
