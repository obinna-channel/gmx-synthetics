const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating Deposit Atomically (Transfer + Create in one tx) ===\n");
    console.log("Signer address:", signer.address);

    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // First check if vault has old balances that need to be cleared
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("Current vault status:");
    console.log("  USDT actual balance:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  sNGN actual balance:", ethers.utils.formatUnits(vaultSngnBalance, 18));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));

    if (usdtRecorded.gt(0) || sngnRecorded.gt(0)) {
        console.log("\n⚠️  Warning: Vault has recorded balances!");
        console.log("This will cause EmptyDepositAmounts error.");
        console.log("The vault needs to be cleared first (withdraw old tokens).");
        return;
    }

    // Amounts to deposit
    const usdtAmount = ethers.utils.parseUnits("1", 6);
    const sngnAmount = ethers.utils.parseUnits("1500", 18);

    console.log("\n📊 Deposit amounts:");
    console.log("  USDT:", ethers.utils.formatUnits(usdtAmount, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(sngnAmount, 18));

    // Check user balances
    const userUsdtBalance = await usdt.balanceOf(signer.address);
    const userSngnBalance = await sngn.balanceOf(signer.address);

    console.log("\n💰 Your balances:");
    console.log("  USDT:", ethers.utils.formatUnits(userUsdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(userSngnBalance, 18));

    if (userUsdtBalance.lt(usdtAmount) || userSngnBalance.lt(sngnAmount)) {
        console.log("❌ Insufficient balances");
        return;
    }

    // Approve Router
    console.log("\n📍 Approving Router...");
    const usdtAllowance = await usdt.allowance(signer.address, ROUTER);
    const sngnAllowance = await sngn.allowance(signer.address, ROUTER);

    if (usdtAllowance.lt(usdtAmount)) {
        const tx = await usdt.approve(ROUTER, usdtAmount);
        await tx.wait();
        console.log("  ✅ USDT approved");
    }

    if (sngnAllowance.lt(sngnAmount)) {
        const tx = await sngn.approve(ROUTER, sngnAmount);
        await tx.wait();
        console.log("  ✅ sNGN approved");
    }

    // Build multicall: sendTokens + sendTokens + createDeposit
    console.log("\n📍 Building atomic multicall (sendTokens + createDeposit)...");

    const multicallData = [];

    // 1. Send USDT
    multicallData.push(
        exchangeRouter.interface.encodeFunctionData("sendTokens", [
            USDT,
            DEPOSIT_VAULT,
            usdtAmount
        ])
    );

    // 2. Send sNGN
    multicallData.push(
        exchangeRouter.interface.encodeFunctionData("sendTokens", [
            sNGN,
            DEPOSIT_VAULT,
            sngnAmount
        ])
    );

    // 3. Create deposit
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

    multicallData.push(
        exchangeRouter.interface.encodeFunctionData("createDeposit", [depositParams])
    );

    console.log("  ✅ Prepared 3 operations:");
    console.log("     1. Send 1 USDT to DepositVault");
    console.log("     2. Send 1500 sNGN to DepositVault");
    console.log("     3. Create deposit with receiver=address(1)");

    // Execute atomic multicall
    console.log("\n📍 Executing atomic multicall...");
    try {
        const tx = await exchangeRouter.multicall(multicallData, { gasLimit: 3000000 });
        console.log("  Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("  ✅ Transaction confirmed!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());
        console.log("  Status:", receipt.status ? "SUCCESS" : "FAILED");

        if (receipt.events && receipt.events.length > 0) {
            console.log("\n  Events:");
            for (const event of receipt.events) {
                if (event.event) {
                    console.log(`    - ${event.event}`);
                }
            }
        }

    } catch (error) {
        console.log("  ❌ Transaction failed:", error.message);

        if (error.error && error.error.data) {
            const errorData = error.error.data;
            if (errorData === "0x01af8c24") {
                console.log("\n  Error: EmptyDepositAmounts");
                console.log("  The vault's tokenBalances are already recorded.");
                console.log("  Need to clear the vault first.");
            }
        }
    }
}

main().catch(console.error);