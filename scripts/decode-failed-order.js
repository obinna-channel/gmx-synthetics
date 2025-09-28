const { ethers } = require("hardhat");

async function main() {
    // The failed order transactions
    const createTxHash = "0x26c1f89046919ada104db06903f751bc4e0bc7517daac6d411806c7ffb4ec4d2";
    const cancelTxHash = "0xe3de1547a4f12227860bc1ca3dbb598010f420787ddea2ecb143e8102f77451b";

    console.log("=== Decoding Failed Order ===\n");

    // Get the creation transaction
    const createTx = await ethers.provider.getTransaction(createTxHash);
    console.log("Creation TX:", createTxHash);
    console.log("From:", createTx.from);
    console.log("To:", createTx.to);

    // Decode the input data
    const iface = new ethers.utils.Interface([
        "function multicall(bytes[] data) payable returns (bytes[] results)",
        "function createOrder(tuple(tuple(address receiver, address cancellationReceiver, address callbackContract, address uiFeeReceiver, address market, address initialCollateralToken, address[] swapPath) addresses, tuple(uint256 sizeDeltaUsd, uint256 initialCollateralDeltaAmount, uint256 triggerPrice, uint256 acceptablePrice, uint256 executionFee, uint256 callbackGasLimit, uint256 minOutputAmount, uint256 validFromTime) numbers, uint8 orderType, uint8 decreasePositionSwapType, bool isLong, bool shouldUnwrapNativeToken, bool autoCancel, bytes32 referralCode, bytes32[] dataList) params) payable returns (bytes32)",
        "function sendWnt(address receiver, uint256 amount) payable",
        "function sendTokens(address token, address receiver, uint256 amount)"
    ]);

    try {
        const decoded = iface.parseTransaction({ data: createTx.data });

        if (decoded.name === "multicall") {
            console.log("\n📦 Multicall detected, decoding inner calls...");

            const multicallData = decoded.args[0];

            for (let i = 0; i < multicallData.length; i++) {
                try {
                    const innerDecoded = iface.parseTransaction({ data: multicallData[i] });

                    if (innerDecoded.name === "createOrder") {
                        console.log(`\n📝 CreateOrder Call:`);

                        const params = innerDecoded.args[0];

                        console.log("\n🔍 Order Details:");
                        console.log("  Market:", params.addresses.market);
                        console.log("  Initial Collateral Token:", params.addresses.initialCollateralToken);
                        console.log("  Size Delta USD:", ethers.utils.formatUnits(params.numbers.sizeDeltaUsd, 30), "USD");
                        console.log("  Initial Collateral Delta:", ethers.utils.formatUnits(params.numbers.initialCollateralDeltaAmount, 6), "USDT");
                        console.log("  Acceptable Price:", params.numbers.acceptablePrice.toString());

                        if (params.numbers.acceptablePrice.gt(0)) {
                            console.log("    → ", ethers.utils.formatUnits(params.numbers.acceptablePrice, 30), "(in 30 decimals)");
                        }

                        console.log("\n  Order Type:", params.orderType);
                        const orderTypeNames = {
                            0: "MarketSwap",
                            1: "LimitSwap",
                            2: "MarketIncrease",
                            3: "LimitIncrease",
                            4: "MarketDecrease",
                            5: "LimitDecrease",
                            6: "StopLossDecrease",
                            7: "Liquidation"
                        };
                        console.log(`    → ${orderTypeNames[params.orderType] || "Unknown"}`);

                        console.log("\n  Decrease Position Swap Type:", params.decreasePositionSwapType);
                        const swapTypeNames = {
                            0: "NoSwap",
                            1: "SwapPnlTokenToCollateralToken",
                            2: "SwapCollateralTokenToPnlToken"
                        };
                        console.log(`    → ${swapTypeNames[params.decreasePositionSwapType] || "Unknown"}`);

                        console.log("\n  Is Long:", params.isLong);
                        console.log("  Min Output Amount:", params.numbers.minOutputAmount.toString());
                        console.log("  Execution Fee:", ethers.utils.formatEther(params.numbers.executionFee), "ETH");

                        // Analyze the configuration
                        console.log("\n🔴 ANALYSIS:");
                        if (params.orderType === 4) { // MarketDecrease
                            console.log("  This is a DECREASE order");
                            if (params.isLong) {
                                console.log("  Position: LONG");
                                if (params.numbers.acceptablePrice.eq(0)) {
                                    console.log("  ⚠️  acceptablePrice = 0 for long decrease");
                                }
                            } else {
                                console.log("  Position: SHORT");
                                if (params.decreasePositionSwapType === 1) {
                                    console.log("  ✓ Using SwapPnlTokenToCollateralToken for short");
                                }

                                // Check acceptable price for shorts
                                if (params.numbers.acceptablePrice.gt(0)) {
                                    const price = ethers.utils.formatUnits(params.numbers.acceptablePrice, 30);
                                    console.log(`  acceptablePrice = ${price}`);

                                    // 1/1500 = 0.000666...
                                    // 1/1490 = 0.000671...
                                    // 1/1510 = 0.000662...

                                    if (price.startsWith("0.000671")) {
                                        console.log("    → This is 1/1490 USDT per NGN");
                                    } else if (price.startsWith("0.000662")) {
                                        console.log("    → This is 1/1510 USDT per NGN");
                                    }
                                }
                            }
                        }
                    } else if (innerDecoded.name === "sendTokens") {
                        console.log(`\n💰 SendTokens Call #${i}:`);
                        console.log("  Token:", innerDecoded.args.token);
                        console.log("  Amount:", ethers.utils.formatUnits(innerDecoded.args.amount, 6), "USDT");
                    }
                } catch (e) {
                    // Not a createOrder call
                }
            }
        }
    } catch (error) {
        console.log("Error decoding:", error.message);
    }

    // Now check the cancellation transaction
    console.log("\n\n=== Checking Cancellation ===");
    console.log("Cancel TX:", cancelTxHash);

    const cancelReceipt = await ethers.provider.getTransactionReceipt(cancelTxHash);
    console.log("Executed by keeper:", cancelReceipt.from);
    console.log("Gas used:", cancelReceipt.gasUsed.toString());

    // Check for specific error events
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    for (const log of cancelReceipt.logs) {
        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
            // Check for SwapReverted event
            const SWAP_REVERTED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SwapReverted"));
            if (log.topics[0] === SWAP_REVERTED_HASH) {
                console.log("\n⚠️ SWAP REVERTED EVENT FOUND!");
            }
        }
    }
}

main().catch(console.error);