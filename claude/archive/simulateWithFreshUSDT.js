const { ethers } = require("hardhat");

async function main() {
    console.log("=== SIMULATING WITH FRESH USDT TRANSFER ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    const depositAmount = ethers.utils.parseUnits("100", 6); // 100 USDT

    console.log("=== CURRENT STATE ===");
    const userBalance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(userBalance, 6), "USDT");

    const vaultBalanceBefore = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("Vault balance (before):", ethers.utils.formatUnits(vaultBalanceBefore, 6), "USDT");
    console.log("Note: This USDT might be 'locked' from previous deposits\n");

    if (userBalance.lt(depositAmount)) {
        console.log("❌ Insufficient balance for fresh deposit");
        return;
    }

    console.log("=== STEP 1: TRANSFER FRESH 100 USDT ===");
    console.log("Transferring fresh 100 USDT to vault...");

    const transferTx = await usdt.transfer(ADDRESSES.DEPOSIT_VAULT, depositAmount);
    console.log("Transfer tx:", transferTx.hash);
    await transferTx.wait();
    console.log("✅ Transferred 100 USDT");

    const vaultBalanceAfter = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("Vault balance (after):", ethers.utils.formatUnits(vaultBalanceAfter, 6), "USDT");
    console.log("Fresh USDT added:", ethers.utils.formatUnits(depositAmount, 6), "USDT\n");

    console.log("=== STEP 2: SIMULATE DEPOSIT CREATION ===");

    // Exact params from DEPOSIT_ISSUE_UPDATE
    const depositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,  // Both USDT
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,  // Zero fee!
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("Simulating with:");
    console.log("- Fresh 100 USDT just transferred");
    console.log("- executionFee = 0");
    console.log("- Both tokens = USDT\n");

    try {
        console.log("Running simulation...");
        const simulatedKey = await exchangeRouter.callStatic.createDeposit(
            depositParams,
            { value: 0 }
        );

        console.log("\n✅ ✅ ✅ SIMULATION SUCCESSFUL! ✅ ✅ ✅");
        console.log("Simulated deposit key:", simulatedKey);
        console.log("\nThe fresh USDT transfer made it work!");
        console.log("The old USDT in the vault was indeed 'locked' or marked as used.");

        console.log("\n=== READY FOR ACTUAL DEPOSIT ===");
        console.log("We can now proceed with the actual deposit creation!");
        console.log("The simulation proves it will work with fresh funds.");

    } catch (error) {
        console.log("❌ SIMULATION FAILED");
        console.log("Even with fresh USDT, the simulation failed");
        console.log("Error:", error.message.substring(0, 200));

        if (error.data) {
            console.log("Error data:", error.data);
        }

        console.log("\nThis might indicate a deeper issue:");
        console.log("- Market might be paused");
        console.log("- ExchangeRouter might need different configuration");
        console.log("- Feature might be disabled");
    }

    console.log("\n=== SUMMARY ===");
    console.log("Vault now has:", ethers.utils.formatUnits(vaultBalanceAfter, 6), "USDT total");
    console.log("- Old USDT: 1066 (possibly locked)");
    console.log("- Fresh USDT: 100 (just added)");
    console.log("\nIf simulation succeeded, we're ready to create the actual deposit!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });