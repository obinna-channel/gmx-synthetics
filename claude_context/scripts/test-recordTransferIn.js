const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING recordTransferIn BEHAVIOR ===\n");

    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const [signer] = await ethers.getSigners();

    // Check initial balance
    const initialBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("Initial DepositVault balance:", ethers.utils.formatUnits(initialBalance, 6), "USDT");

    // Transfer some USDT
    console.log("\n1. Transferring 5 USDT to DepositVault...");
    await usdt.transfer(DEPOSIT_VAULT, ethers.utils.parseUnits("5", 6));

    const afterTransfer = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("After transfer:", ethers.utils.formatUnits(afterTransfer, 6), "USDT");

    // Now try to call recordTransferIn twice (simulating what createDeposit does)
    console.log("\n2. Testing recordTransferIn behavior...");

    try {
        // First call - should detect the 5 USDT
        console.log("Calling recordTransferIn(USDT) first time...");
        const amount1 = await depositVault.callStatic.recordTransferIn(USDT);
        console.log("First call would return:", ethers.utils.formatUnits(amount1, 6), "USDT");

        // Second call - what would it return?
        console.log("\nCalling recordTransferIn(USDT) second time...");
        const amount2 = await depositVault.callStatic.recordTransferIn(USDT);
        console.log("Second call would return:", ethers.utils.formatUnits(amount2, 6), "USDT");

        if (amount1.gt(0) && amount2.eq(0)) {
            console.log("\n❌ CONFIRMED: Second recordTransferIn returns 0!");
            console.log("This would cause EmptyDepositAmounts error for single-token markets.");
        } else if (amount1.eq(amount2)) {
            console.log("\n✅ Both calls return the same amount");
            console.log("This is NOT the issue.");
        }
    } catch (error) {
        console.log("Error calling recordTransferIn:", error.message);
        console.log("\nThis might mean only authorized contracts can call it.");
    }

    // Let's also check what error we're actually getting
    console.log("\n3. Checking the actual error signature from our failed transaction...");

    // From our previous failed transaction
    const failedTxHash = "0x02f4add2dd13f88f564b10886b61a9e71a7fea046eb481007f48fea89e98a1e9";

    try {
        const tx = await ethers.provider.getTransaction(failedTxHash);
        const receipt = await ethers.provider.getTransactionReceipt(failedTxHash);

        console.log("Transaction status:", receipt.status === 1 ? "Success" : "Failed");
        console.log("Gas used:", receipt.gasUsed.toString());

        // Try to get the revert reason
        try {
            const code = await ethers.provider.call(tx, tx.blockNumber);
            console.log("Return data:", code);
        } catch (callError) {
            console.log("Call error data:", callError.data || "No data");
        }
    } catch (error) {
        console.log("Error fetching transaction:", error.message);
    }
}

main().catch(console.error);