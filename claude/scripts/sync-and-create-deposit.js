const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Sync Token Balances and Create Deposit ===\n");

    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Check current status
    console.log("Current DepositVault status:");
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    console.log("  USDT balance:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  sNGN balance:", ethers.utils.formatUnits(vaultSngnBalance, 18));

    const usdtTokenBalance = await depositVault.tokenBalances(USDT);
    const sngnTokenBalance = await depositVault.tokenBalances(sNGN);
    console.log("  USDT recorded:", ethers.utils.formatUnits(usdtTokenBalance, 6));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnTokenBalance, 18));

    // Try to sync token balances
    console.log("\nAttempting to sync token balances...");
    try {
        console.log("  Syncing USDT...");
        const syncUsdtTx = await depositVault.syncTokenBalance(USDT);
        await syncUsdtTx.wait();
        console.log("  ✅ USDT synced");

        console.log("  Syncing sNGN...");
        const syncSngnTx = await depositVault.syncTokenBalance(sNGN);
        await syncSngnTx.wait();
        console.log("  ✅ sNGN synced");

        // Check after sync
        const usdtAfter = await depositVault.tokenBalances(USDT);
        const sngnAfter = await depositVault.tokenBalances(sNGN);
        console.log("\nAfter sync:");
        console.log("  USDT recorded:", ethers.utils.formatUnits(usdtAfter, 6));
        console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnAfter, 18));
    } catch (error) {
        console.log("  ❌ Sync failed:", error.message);
        console.log("  This likely means we don't have CONTROLLER role on DepositVault");
    }

    // Now try to create deposit
    console.log("\n📍 Creating deposit...");
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: sNGN,
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
        const createDepositTx = await exchangeRouter.createDeposit(depositParams, { gasLimit: 2500000 });
        console.log("  Transaction sent:", createDepositTx.hash);
        const receipt = await createDepositTx.wait();
        console.log("  ✅ Deposit created!");
        console.log("  Gas used:", receipt.gasUsed.toString());
    } catch (error) {
        console.log("  ❌ Create deposit failed:", error.message);

        // Try with static call to get more info
        try {
            await exchangeRouter.callStatic.createDeposit(depositParams);
        } catch (staticError) {
            console.log("\nStatic call error:", staticError.message);
        }
    }
}

main().catch(console.error);