const { ethers } = require("hardhat");

async function main() {
    console.log("=== SIMULATING WITH CORRECT FEE TO GET ERROR ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"
    };

    const [signer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    // Try with correct execution fee
    const correctFee = ethers.utils.parseEther("0.002");

    const depositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: correctFee,
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("Simulating with 0.002 ETH execution fee...");
    try {
        const result = await exchangeRouter.callStatic.createDeposit(
            depositParams,
            {
                value: correctFee,
                from: signer.address
            }
        );
        console.log("✅ Simulation succeeded! Deposit key:", result);
    } catch (error) {
        console.log("❌ Still failing with correct fee!");

        if (error.reason) {
            console.log("Reason:", error.reason);
        }

        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);

            // Decode the error
            const errorData = error.error.data;

            // Try common error signatures
            const signatures = [
                "error EmptyDepositAmounts()",
                "error InsufficientExecutionFee(uint256,uint256)",
                "error InsufficientWntAmountForExecutionFee(uint256,uint256)",
                "error InvalidPoolAmount()"
            ];

            for (const sig of signatures) {
                try {
                    const iface = new ethers.utils.Interface([sig]);
                    const decoded = iface.parseError(errorData);
                    console.log("\n✅ Decoded error:", decoded.name);
                    if (decoded.args && decoded.args.length > 0) {
                        decoded.args.forEach((arg, i) => {
                            console.log(`  Arg ${i}:`, arg.toString());
                        });
                    }
                    break;
                } catch (e) {
                    // Continue
                }
            }

            // If it's still the execution fee error (0x3a78cd7e)
            if (errorData.startsWith("0x3a78cd7e")) {
                console.log("\n⚠️  Still InsufficientExecutionFee error!");
                console.log("   The validation is still failing even with 0.002 ETH");
            }
        }
    }

    // Try with even more fee
    console.log("\nTrying with 0.01 ETH execution fee...");
    const higherFee = ethers.utils.parseEther("0.01");
    depositParams.executionFee = higherFee;

    try {
        const result = await exchangeRouter.callStatic.createDeposit(
            depositParams,
            {
                value: higherFee,
                from: signer.address
            }
        );
        console.log("✅ Works with 0.01 ETH! Deposit key:", result);
    } catch (error) {
        if (error.reason) {
            console.log("❌ Still fails with 0.01 ETH:", error.reason.substring(0, 100));
        }
    }
}

main().catch(console.error);