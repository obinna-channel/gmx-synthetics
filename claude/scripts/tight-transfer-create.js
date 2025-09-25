const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Tightest Possible Transfer + CreateDeposit ===\n");
    console.log("Signer address:", signer.address);

    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Prepare amounts
    const usdtAmount = ethers.utils.parseUnits("1", 6);
    const sngnAmount = ethers.utils.parseUnits("1500", 18);

    // Prepare deposit params BEFORE transfer
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

    console.log("📍 Attempting the tightest sequence possible...");
    console.log("  1. Transfer USDT to vault");
    console.log("  2. Transfer sNGN to vault");
    console.log("  3. Immediately call createDeposit");
    console.log("  All in rapid succession\n");

    try {
        // Transfer USDT
        console.log("Transferring USDT...");
        const tx1 = await usdt.transfer(DEPOSIT_VAULT, usdtAmount);
        console.log("  TX1 hash:", tx1.hash);

        // Transfer sNGN (don't wait for USDT confirmation)
        console.log("Transferring sNGN...");
        const tx2 = await sngn.transfer(DEPOSIT_VAULT, sngnAmount);
        console.log("  TX2 hash:", tx2.hash);

        // Immediately create deposit (don't wait for transfers to confirm)
        console.log("Creating deposit...");
        const tx3 = await exchangeRouter.createDeposit(depositParams, { gasLimit: 2500000 });
        console.log("  TX3 hash:", tx3.hash);

        // Now wait for all to complete
        console.log("\nWaiting for confirmations...");
        const receipt1 = await tx1.wait();
        console.log("  ✅ USDT transfer confirmed in block", receipt1.blockNumber);

        const receipt2 = await tx2.wait();
        console.log("  ✅ sNGN transfer confirmed in block", receipt2.blockNumber);

        const receipt3 = await tx3.wait();
        console.log("  Deposit creation status:", receipt3.status ? "SUCCESS" : "FAILED");

        if (receipt3.status) {
            console.log("  ✅ Deposit created in block", receipt3.blockNumber);

            // Check for events
            if (receipt3.events && receipt3.events.length > 0) {
                console.log("\n  Events:");
                for (const event of receipt3.events) {
                    if (event.event) {
                        console.log(`    - ${event.event}`);
                        if (event.event === "DepositCreated") {
                            console.log("      🎉 DEPOSIT SUCCESSFULLY CREATED!");
                        }
                    }
                }
            }
        } else {
            console.log("  ❌ Deposit creation failed");
        }

    } catch (error) {
        console.log("\n❌ Error:", error.message);

        // Try to understand what happened
        const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
        const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
        const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
        const usdtRecorded = await depositVault.tokenBalances(USDT);
        const sngnRecorded = await depositVault.tokenBalances(sNGN);

        console.log("\nVault status after error:");
        console.log("  USDT balance:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
        console.log("  USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
        console.log("  sNGN balance:", ethers.utils.formatUnits(vaultSngnBalance, 18));
        console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));

        // Determine the issue
        if (vaultUsdtBalance.gt(0) && usdtRecorded.eq(0)) {
            console.log("\n⚠️  Tokens reached vault but weren't recorded");
            console.log("  The createDeposit call likely executed before transfers were processed");
        } else if (usdtRecorded.gt(0)) {
            console.log("\n⚠️  Tokens were recorded in vault");
            console.log("  The createDeposit's recordTransferIn would return 0");
        }
    }
}

main().catch(console.error);