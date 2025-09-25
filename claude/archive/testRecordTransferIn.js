const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING RECORD TRANSFER IN ===\n");

    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";

    const [signer] = await ethers.getSigners();
    const depositVault = await ethers.getContractAt("StrictBank", DEPOSIT_VAULT);
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Check if we have CONTROLLER role
    const CONTROLLER = ethers.utils.id("CONTROLLER");
    const hasController = await roleStore.hasRole(signer.address, CONTROLLER);

    if (!hasController) {
        console.log("Granting CONTROLLER role...");
        const tx = await roleStore.grantRole(signer.address, CONTROLLER);
        await tx.wait();
        console.log("✅ CONTROLLER role granted\n");
    }

    // Check current balance
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("Current USDT in vault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Check tokenBalances mapping
    const storedBalance = await depositVault.tokenBalances(USDT);
    console.log("Stored balance in mapping:", ethers.utils.formatUnits(storedBalance, 6), "USDT");

    if (!vaultBalance.eq(storedBalance)) {
        console.log("\n⚠️ MISMATCH! Actual balance doesn't match stored balance");
        console.log("This will cause recordTransferIn to calculate wrong amount");

        // Sync the balance
        console.log("\nSyncing balance...");
        try {
            const syncTx = await depositVault.syncTokenBalance(USDT);
            await syncTx.wait();
            console.log("✅ Balance synced");

            const newStoredBalance = await depositVault.tokenBalances(USDT);
            console.log("New stored balance:", ethers.utils.formatUnits(newStoredBalance, 6), "USDT");
        } catch (e) {
            console.log("❌ Could not sync:", e.message);
        }
    }

    // Test recordTransferIn
    console.log("\n=== TESTING recordTransferIn ===");

    // First, send some USDT to vault
    console.log("Sending 10 USDT to vault...");
    const amount = ethers.utils.parseUnits("10", 6);
    const transferTx = await usdt.transfer(DEPOSIT_VAULT, amount);
    await transferTx.wait();
    console.log("✅ Sent 10 USDT");

    // Now call recordTransferIn
    console.log("\nCalling recordTransferIn...");
    try {
        const recorded = await depositVault.callStatic.recordTransferIn(USDT);
        console.log("✅ Would record:", ethers.utils.formatUnits(recorded, 6), "USDT");

        // Actually do it
        const recordTx = await depositVault.recordTransferIn(USDT);
        await recordTx.wait();
        console.log("✅ Successfully recorded transfer");
    } catch (e) {
        console.log("❌ recordTransferIn failed:", e.message);
    }

    // Check final state
    console.log("\n=== FINAL STATE ===");
    const finalVaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const finalStoredBalance = await depositVault.tokenBalances(USDT);
    console.log("Actual balance:", ethers.utils.formatUnits(finalVaultBalance, 6), "USDT");
    console.log("Stored balance:", ethers.utils.formatUnits(finalStoredBalance, 6), "USDT");
    console.log("Match:", finalVaultBalance.eq(finalStoredBalance) ? "✅" : "❌");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });