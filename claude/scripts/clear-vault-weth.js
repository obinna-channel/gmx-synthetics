const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Clearing WETH from Deposit Vault ===\n");
    console.log("Signer:", signer.address);

    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";

    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const weth = await ethers.getContractAt("IERC20", WETH);

    // Check current balance
    const wethBalance = await weth.balanceOf(DEPOSIT_VAULT);
    const recordedBalance = await depositVault.tokenBalances(WETH);

    console.log("Current WETH in vault:");
    console.log("  Actual:", ethers.utils.formatEther(wethBalance));
    console.log("  Recorded:", ethers.utils.formatEther(recordedBalance));

    if (wethBalance.gt(0)) {
        try {
            console.log("\n📍 Attempting to transfer out WETH...");

            // Try to transfer out the WETH
            const tx = await depositVault["transferOut(address,address,uint256,bool)"](
                WETH,
                signer.address,
                wethBalance,
                false // don't unwrap native token
            );

            console.log("  Transaction sent:", tx.hash);
            const receipt = await tx.wait();
            console.log("  ✅ Transfer successful!");
            console.log("  Gas used:", receipt.gasUsed.toString());

            // Sync the balance
            console.log("\n📍 Syncing token balance...");
            const syncTx = await depositVault.syncTokenBalance(WETH);
            await syncTx.wait();
            console.log("  ✅ Balance synced");

            // Verify
            const newBalance = await weth.balanceOf(DEPOSIT_VAULT);
            console.log("\n📊 Final state:");
            console.log("  WETH in vault:", ethers.utils.formatEther(newBalance));

        } catch (error) {
            console.log("❌ Failed to transfer WETH:", error.message);

            // Try just syncing
            console.log("\n📍 Trying to sync balance instead...");
            try {
                const syncTx = await depositVault.syncTokenBalance(WETH);
                await syncTx.wait();
                console.log("  ✅ Balance synced");
            } catch (syncError) {
                console.log("  ❌ Sync also failed:", syncError.message);
            }
        }
    } else {
        console.log("\n✅ Vault already has 0 WETH");
    }
}

main().catch(console.error);