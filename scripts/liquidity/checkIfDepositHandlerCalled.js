const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING IF DEPOSITHANDLER IS ACTUALLY CALLED ===\n");

    // Let's use a different approach - check if the DepositHandler address is correct
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    // Read the depositHandler from ExchangeRouter
    const depositHandlerAddress = await exchangeRouter.depositHandler();
    console.log("DepositHandler in ExchangeRouter:", depositHandlerAddress);
    console.log("Expected DepositHandler:", DEPOSIT_HANDLER);

    if (depositHandlerAddress.toLowerCase() !== DEPOSIT_HANDLER.toLowerCase()) {
        console.log("❌ MISMATCH!");
        return;
    }

    console.log("✅ Address matches\n");

    // Let's check if maybe the issue is that the ExchangeRouter's createDeposit
    // has been modified or overridden somehow

    console.log("=== CHECKING EXCHANGEROUTER IMPLEMENTATION ===");

    // Get the ExchangeRouter's source code hash
    const provider = ethers.provider;
    const bytecode = await provider.getCode(EXCHANGE_ROUTER);

    // Check if it matches what we expect from compilation
    const ExchangeRouterFactory = await ethers.getContractFactory("ExchangeRouter");
    const expectedBytecode = ExchangeRouterFactory.bytecode;

    console.log("Deployed bytecode length:", bytecode.length);
    console.log("Expected bytecode length:", expectedBytecode.length);

    if (bytecode.length !== expectedBytecode.length) {
        console.log("⚠️ Bytecode lengths don't match!");
        console.log("This suggests the deployed contract is different from source.");

        // Check if it's just the immutable values that differ
        const deployedBody = bytecode.slice(0, -640); // Remove immutables
        const expectedBody = expectedBytecode.slice(0, -640);

        if (deployedBody === expectedBody) {
            console.log("✅ But the main contract body matches (only immutables differ)");
        } else {
            console.log("❌ The contract body itself is different!");
            console.log("This confirms the deployed contract has different code.");
        }
    } else {
        console.log("✅ Bytecode lengths match");
    }

    // Final check - let's see if createDeposit reverts when we call it
    console.log("\n=== TESTING STATIC CALL ===");

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
            initialLongToken: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
            initialShortToken: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    try {
        // This won't actually create a deposit but will tell us what would happen
        const result = await exchangeRouter.callStatic.createDeposit(depositParams);
        console.log("Static call returned:", result);
        console.log("This means the function executes without reverting");
    } catch (error) {
        console.log("Static call reverted:", error.message);
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