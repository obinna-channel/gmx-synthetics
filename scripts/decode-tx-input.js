const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x56c82ef335c9c5112ba621a3a111117f4a62d3d75d2f2fed6fe47a6ae112a393"; // Your order creation tx

    console.log("=== Decoding Transaction Input ===\n");
    console.log("Transaction:", txHash);

    const tx = await ethers.provider.getTransaction(txHash);

    if (!tx) {
        console.log("Transaction not found");
        return;
    }

    console.log("To:", tx.to);
    console.log("From:", tx.from);

    // ExchangeRouter interface for decoding
    const iface = new ethers.utils.Interface([
        "function multicall(bytes[] data) payable returns (bytes[] results)",
        "function createOrder(tuple(tuple(address receiver, address cancellationReceiver, address callbackContract, address uiFeeReceiver, address market, address initialCollateralToken, address[] swapPath) addresses, tuple(uint256 sizeDeltaUsd, uint256 initialCollateralDeltaAmount, uint256 triggerPrice, uint256 acceptablePrice, uint256 executionFee, uint256 callbackGasLimit, uint256 minOutputAmount, uint256 validFromTime) numbers, uint8 orderType, uint8 decreasePositionSwapType, bool isLong, bool shouldUnwrapNativeToken, bool autoCancel, bytes32 referralCode, bytes32[] dataList) params) payable returns (bytes32)"
    ]);

    try {
        // First decode the multicall
        const decoded = iface.parseTransaction({ data: tx.data });

        if (decoded.name === "multicall") {
            console.log("\nMulticall detected, decoding inner calls...");

            const multicallData = decoded.args[0];

            for (let i = 0; i < multicallData.length; i++) {
                try {
                    const innerDecoded = iface.parseTransaction({ data: multicallData[i] });

                    if (innerDecoded.name === "createOrder") {
                        console.log(`\n📝 CreateOrder Call #${i + 1}:`);

                        const params = innerDecoded.args[0];

                        console.log("\nOrder Parameters:");
                        console.log("  Market:", params.addresses.market);
                        console.log("  Initial Collateral Token:", params.addresses.initialCollateralToken);
                        console.log("  Size Delta USD:", ethers.utils.formatUnits(params.numbers.sizeDeltaUsd, 30), "USD");
                        console.log("  Initial Collateral Delta:", ethers.utils.formatUnits(params.numbers.initialCollateralDeltaAmount, 6), "USDT");
                        console.log("  Order Type:", params.orderType);

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

                        console.log("\n🔴 CRITICAL FIELD:");
                        console.log("  Decrease Position Swap Type:", params.decreasePositionSwapType);

                        const swapTypeNames = {
                            0: "NoSwap",
                            1: "SwapPnlTokenToCollateralToken",
                            2: "SwapCollateralTokenToPnlToken"
                        };
                        console.log(`    → ${swapTypeNames[params.decreasePositionSwapType] || "Unknown"}`);

                        console.log("\n  Is Long:", params.isLong);
                        console.log("  Should Unwrap Native Token:", params.shouldUnwrapNativeToken);
                        console.log("  Auto Cancel:", params.autoCancel);

                        if (params.orderType === 4 && !params.isLong) {
                            console.log("\n⚠️  This is a SHORT DECREASE order!");
                            if (params.decreasePositionSwapType === 0) {
                                console.log("❌ Using NoSwap - This will likely fail!");
                                console.log("   Should use SwapPnlTokenToCollateralToken (1) instead");
                            } else if (params.decreasePositionSwapType === 1) {
                                console.log("✅ Using SwapPnlTokenToCollateralToken - This is correct!");
                            }
                        }
                    }
                } catch (e) {
                    // Not a createOrder call, skip
                }
            }
        }
    } catch (error) {
        console.log("Error decoding transaction:", error.message);
    }
}

main().catch(console.error);