const { ethers } = require("hardhat");

async function main() {
    console.log("=== SIMULATING FIRST DEPOSIT WITH RECEIVER AS ADDRESS(1) ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Check USDT balance
    const balance = await usdt.balanceOf(signer.address);
    console.log("\nUSDT Balance:", ethers.utils.formatUnits(balance, 6), "USDT");

    if (balance.lt(ethers.utils.parseUnits("100", 6))) {
        console.log("❌ Insufficient USDT balance. Need at least 100 USDT");
        return;
    }

    // First approve and transfer USDT to ExchangeRouter
    const amount = ethers.utils.parseUnits("100", 6);
    console.log("\nSimulating transfer of 100 USDT to ExchangeRouter...");

    // Create deposit parameters with receiver as address(1)
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // ADDRESS(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n=== DEPOSIT PARAMETERS ===");
    console.log("Receiver: 0x0000000000000000000000000000000000000001 (address(1))");
    console.log("Market:", MARKET);
    console.log("Initial Long Token:", USDT);
    console.log("Initial Short Token:", USDT);
    console.log("Execution Fee: 0");
    console.log("Amount: 100 USDT");

    try {
        // First simulate the transfer
        console.log("\n=== SIMULATING TRANSFER ===");
        await usdt.callStatic.transfer(EXCHANGE_ROUTER, amount);
        console.log("✅ Transfer simulation successful");

        // Actually do the transfer for the createDeposit simulation
        const transferTx = await usdt.transfer(EXCHANGE_ROUTER, amount);
        await transferTx.wait();
        console.log("✅ Transferred 100 USDT to ExchangeRouter");

        // Now simulate the createDeposit call
        console.log("\n=== SIMULATING CREATE DEPOSIT ===");
        const result = await exchangeRouter.callStatic.createDeposit(depositParams, { value: 0 });

        console.log("\n✅ SIMULATION SUCCESSFUL!");
        console.log("Deposit key that would be created:", result);
        console.log("\nThe deposit with receiver as address(1) can be created successfully.");
        console.log("This should allow the first deposit to be executed properly.");

    } catch (error) {
        console.log("\n❌ Simulation failed:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);

            // Try to decode error
            const errorSignatures = {
                "0x01af8c24": "Likely insufficient funds or wrong parameters",
                "0xf9996e9f": "InvalidPoolValueForDeposit",
                "0x8c364c42": "InvalidReceiverForFirstDeposit"
            };

            if (errorSignatures[error.data]) {
                console.log("Error type:", errorSignatures[error.data]);
            }
        }
    }

    // Check current ExchangeRouter USDT balance
    const routerBalance = await usdt.balanceOf(EXCHANGE_ROUTER);
    console.log("\n=== POST-SIMULATION STATE ===");
    console.log("ExchangeRouter USDT balance:", ethers.utils.formatUnits(routerBalance, 6), "USDT");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });