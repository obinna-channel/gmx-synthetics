const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Clearing Stuck Vault Tokens ===\n");
    console.log("Signer address:", signer.address);

    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    // Check initial balances
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const usdtRecorded = await depositVault.tokenBalances(USDT);
    const sngnRecorded = await depositVault.tokenBalances(sNGN);

    console.log("Current vault state:");
    console.log("  USDT balance:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  USDT recorded:", ethers.utils.formatUnits(usdtRecorded, 6));
    console.log("  sNGN balance:", ethers.utils.formatUnits(vaultSngnBalance, 18));
    console.log("  sNGN recorded:", ethers.utils.formatUnits(sngnRecorded, 18));

    if (vaultUsdtBalance.eq(0) && vaultSngnBalance.eq(0)) {
        console.log("\n✅ Vault is already empty!");
        return;
    }

    console.log("\n📍 Attempting to withdraw stuck tokens...");

    try {
        // Try to withdraw USDT
        if (vaultUsdtBalance.gt(0)) {
            console.log("\nWithdrawing USDT...");
            const tx1 = await depositVault["transferOut(address,address,uint256,bool)"](
                USDT, 
                signer.address, 
                vaultUsdtBalance, 
                false
            );
            await tx1.wait();
            console.log("  ✅ USDT withdrawn:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
        }

        // Try to withdraw sNGN
        if (vaultSngnBalance.gt(0)) {
            console.log("\nWithdrawing sNGN...");
            const tx2 = await depositVault["transferOut(address,address,uint256,bool)"](
                sNGN, 
                signer.address, 
                vaultSngnBalance, 
                false
            );
            await tx2.wait();
            console.log("  ✅ sNGN withdrawn:", ethers.utils.formatUnits(vaultSngnBalance, 18));
        }

        // Sync balances to reset recorded amounts
        console.log("\nSyncing vault balances...");
        await depositVault.syncTokenBalance(USDT);
        await depositVault.syncTokenBalance(sNGN);
        console.log("  ✅ Balances synced");

    } catch (error) {
        console.log("\n❌ Error clearing vault:", error.message);
        
        // If direct withdrawal fails, check if we need special permissions
        const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
        const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
        
        const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
        const hasControllerRole = await roleStore.hasRole(signer.address, CONTROLLER_ROLE);
        
        if (!hasControllerRole) {
            console.log("\n⚠️  You don't have CONTROLLER role to withdraw from vault directly.");
            console.log("You may need to wait for the deposit to be executed by a keeper.");
        }
    }

    // Check final balances
    const finalVaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const finalVaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);
    const userUsdtBalance = await usdt.balanceOf(signer.address);
    const userSngnBalance = await sngn.balanceOf(signer.address);

    console.log("\nFinal vault state:");
    console.log("  USDT:", ethers.utils.formatUnits(finalVaultUsdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(finalVaultSngnBalance, 18));
    
    console.log("\nYour balances:");
    console.log("  USDT:", ethers.utils.formatUnits(userUsdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(userSngnBalance, 18));
}

main().catch(console.error);