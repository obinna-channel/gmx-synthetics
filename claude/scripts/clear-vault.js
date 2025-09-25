const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Clearing DepositVault ===\n");

    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Check current status
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("Before clearing:");
    console.log("  USDT actual:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  sNGN actual:", ethers.utils.formatUnits(vaultSngnBalance, 18));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));

    // Withdraw tokens
    console.log("\nWithdrawing tokens from vault...");

    try {
        if (vaultUsdtBalance.gt(0)) {
            console.log("  Withdrawing USDT...");
            const tx1 = await depositVault["transferOut(address,address,uint256,bool)"](
                USDT,
                signer.address,
                vaultUsdtBalance,
                false // shouldUnwrapNativeToken
            );
            await tx1.wait();
            console.log("  ✅ USDT withdrawn");
        }

        if (vaultSngnBalance.gt(0)) {
            console.log("  Withdrawing sNGN...");
            const tx2 = await depositVault["transferOut(address,address,uint256,bool)"](
                sNGN,
                signer.address,
                vaultSngnBalance,
                false // shouldUnwrapNativeToken
            );
            await tx2.wait();
            console.log("  ✅ sNGN withdrawn");
        }

        // Reset recorded balances
        console.log("\nResetting recorded balances...");
        if (usdtRecorded.gt(0)) {
            const tx3 = await depositVault.syncTokenBalance(USDT);
            await tx3.wait();
            console.log("  ✅ USDT balance reset");
        }

        if (sngnRecorded.gt(0)) {
            const tx4 = await depositVault.syncTokenBalance(sNGN);
            await tx4.wait();
            console.log("  ✅ sNGN balance reset");
        }

    } catch (error) {
        console.log("  ❌ Error:", error.message);
        console.log("  You may not have CONTROLLER role on DepositVault");
    }

    // Check final status
    const finalUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const finalSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const finalUsdtRecorded = await depositVault.tokenBalances(USDT);
    const finalSngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("\nAfter clearing:");
    console.log("  USDT actual:", ethers.utils.formatUnits(finalUsdtBalance, 6));
    console.log("  USDT recorded:", ethers.utils.formatUnits(finalUsdtRecorded, 6));
    console.log("  sNGN actual:", ethers.utils.formatUnits(finalSngnBalance, 18));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(finalSngnRecorded, 18));

    if (finalUsdtRecorded.eq(0) && finalSngnRecorded.eq(0)) {
        console.log("\n✅ Vault is clear! Ready for new deposit.");
    } else {
        console.log("\n⚠️  Vault still has recorded balances.");
    }
}

main().catch(console.error);