const { ethers } = require("hardhat");

async function main() {
    console.log("=== CREATING DEPOSIT WITH CORRECT FLOW ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        ROUTER: "0x200882043647295a21F9202f9C1535BfB2A2f127", // From deployment
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    const amount = ethers.utils.parseUnits("50", 6);

    // Step 1: Approve ROUTER (not ExchangeRouter) to spend USDT
    console.log("=== STEP 1: APPROVE ROUTER ===");
    console.log("Approving Router to spend 50 USDT...");

    const approveTx = await usdt.approve(ADDRESSES.ROUTER, amount);
    await approveTx.wait();
    console.log("✅ Router approved to spend USDT");

    // Step 2: Use multicall to send tokens and create deposit in one transaction
    console.log("\n=== STEP 2: SEND TOKENS AND CREATE DEPOSIT ===");

    // Prepare deposit parameters
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // ADDRESS(1) for first deposit
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
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    // Encode the two calls
    const sendTokensCall = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        ADDRESSES.USDT,
        ADDRESSES.DEPOSIT_VAULT,
        amount
    ]);

    const createDepositCall = exchangeRouter.interface.encodeFunctionData("createDeposit", [
        depositParams
    ]);

    console.log("Sending tokens to DepositVault and creating deposit...");

    try {
        // Check if ExchangeRouter has multicall
        if (exchangeRouter.multicall) {
            console.log("Using multicall...");
            const tx = await exchangeRouter.multicall([sendTokensCall, createDepositCall], {
                value: 0,
                gasLimit: 2000000
            });

            console.log("Transaction sent:", tx.hash);
            const receipt = await tx.wait();

            console.log("\n✅ Transaction confirmed!");
            console.log("Block:", receipt.blockNumber);
            console.log("Gas used:", receipt.gasUsed.toString());
        } else {
            // If no multicall, do it in two separate calls (less ideal)
            console.log("No multicall, using separate transactions...");

            // First send tokens
            console.log("\nSending tokens to DepositVault...");
            const sendTx = await exchangeRouter.sendTokens(
                ADDRESSES.USDT,
                ADDRESSES.DEPOSIT_VAULT,
                amount,
                { value: 0 }
            );
            await sendTx.wait();
            console.log("✅ Tokens sent");

            // Then create deposit
            console.log("\nCreating deposit...");
            const createTx = await exchangeRouter.createDeposit(
                depositParams,
                { value: 0, gasLimit: 1000000 }
            );

            console.log("Transaction sent:", createTx.hash);
            const receipt = await createTx.wait();

            console.log("\n✅ Deposit created!");
            console.log("Block:", receipt.blockNumber);
        }

        console.log("\n🎉 SUCCESS!");
        console.log("Deposit should now be created with:");
        console.log("✅ Correct token transfer flow");
        console.log("✅ Receiver as address(1)");
        console.log("✅ Ready for execution");

    } catch (error) {
        console.log("\n❌ Failed:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });