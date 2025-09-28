const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Test Order for Event Listener ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses (from deployments/marks/arbitrumSepolia)
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const ORDER_VAULT = "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F"; // OrderVault.json
    const ORDER_HANDLER = "0x83f2D66af7f794893C31c0B32BD2D4cE826871d7"; // OrderHandler.json
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    // Market and tokens
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1"; // USDT market
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    console.log("📍 Market:", MARKET);
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

    // Order parameters - small market buy order
    const orderAmount = ethers.utils.parseUnits("10", 6); // 10 USDT
    const sizeDeltaUsd = ethers.utils.parseUnits("10", 30); // $10 position size
    const executionFee = ethers.utils.parseEther("0.001"); // 0.001 ETH

    console.log("\n📊 Order Configuration:");
    console.log("  Type: Market Increase (Buy/Long)");
    console.log("  Collateral: 10 USDT");
    console.log("  Position Size: $10");
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
    if (usdtBalance.lt(orderAmount)) {
        console.log("❌ Insufficient USDT");
        return;
    }

    // Step 1: Approve USDT to Router
    console.log("\n📍 Step 1: Approve Router for USDT");
    const allowance = await usdt.allowance(signer.address, ROUTER);
    if (allowance.lt(orderAmount)) {
        const tx = await usdt.approve(ROUTER, orderAmount);
        await tx.wait();
        console.log("  ✅ USDT approved");
    } else {
        console.log("  ✅ USDT already approved");
    }

    // Step 2: Build multicall for order creation
    console.log("\n📍 Step 2: Building order creation multicall");

    const multicallData = [];

    // Send execution fee (WNT)
    const sendWntData = exchangeRouter.interface.encodeFunctionData("sendWnt", [
        ORDER_VAULT,
        executionFee
    ]);
    multicallData.push(sendWntData);

    // Send USDT collateral
    const sendTokensData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        ORDER_VAULT,
        orderAmount
    ]);
    multicallData.push(sendTokensData);

    // Create market increase order
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
            initialCollateralDeltaAmount: orderAmount,
            triggerPrice: 0, // Not needed for market order
            acceptablePrice: ethers.utils.parseUnits("2", 30), // $2 max price (very high for market order)
            executionFee: executionFee,
            callbackGasLimit: 0,
            minOutputAmount: 0,
            validFromTime: 0
        },
        orderType: 2, // MarketIncrease
        decreasePositionSwapType: 0, // NoSwap
        isLong: true, // Long position
        shouldUnwrapNativeToken: false,
        autoCancel: false,
        referralCode: ethers.constants.HashZero, // bytes32(0)
        dataList: [] // Empty array for additional data
    };

    const createOrderData = exchangeRouter.interface.encodeFunctionData("createOrder", [
        orderParams
    ]);
    multicallData.push(createOrderData);

    // Step 3: Execute multicall
    console.log("\n📍 Step 3: Creating order...");

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
        for (const log of receipt.logs) {
            if (log.topics && log.topics.length >= 3) {
                // Look for potential order key in topics
                const potentialKey = log.topics[1] || log.topics[2];
                if (potentialKey && potentialKey.length === 66) {
                    orderKey = potentialKey;
                    console.log("\n🔑 ORDER KEY:", orderKey);
                    break;
                }
            }
        }

        console.log("\n🎯 Check your event listener - it should detect this order!");
        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

    } catch (error) {
        console.log("\n❌ Error creating order:", error.message);
        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);