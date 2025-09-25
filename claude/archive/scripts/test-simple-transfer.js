const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING SIMPLE TRANSFER VIA ROUTER ===\n");

    const [deployer] = await ethers.getSigners();
    const ROUTER = ethers.utils.getAddress("0x8209149be8c79b93c19efb0f92281b7c4b90fb75");
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const TEST_RECEIVER = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"; // DepositVault

    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);
    const router = await ethers.getContractAt("Router", ROUTER);

    console.log("Testing direct transferFrom by Router...\n");

    // Test amount: 1 USDT
    const testAmount = ethers.utils.parseUnits("1", 6);

    // Check allowance
    const allowance = await usdt.allowance(deployer.address, ROUTER);
    console.log("Current allowance:", ethers.utils.formatUnits(allowance, 6), "USDT");

    // Try direct transfer using router
    console.log("\nAttempting Router.pluginTransfer (requires ROUTER_PLUGIN role)...");
    try {
        // This will fail because we don't have ROUTER_PLUGIN role
        const tx = await router.pluginTransfer(USDT, deployer.address, TEST_RECEIVER, testAmount);
        await tx.wait();
        console.log("✓ Transfer successful");
    } catch (e) {
        console.log("✗ Expected failure:", e.reason || "Unauthorized");
    }

    // Now test via ExchangeRouter
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    console.log("\n=== TESTING VIA EXCHANGE ROUTER ===");
    console.log("Attempting ExchangeRouter.sendTokens...");
    console.log("  Token:", USDT);
    console.log("  Receiver:", TEST_RECEIVER);
    console.log("  Amount: 1 USDT");

    try {
        const tx = await exchangeRouter.sendTokens(USDT, TEST_RECEIVER, testAmount);
        const receipt = await tx.wait();
        console.log("✓ SUCCESS! Transfer worked!");
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Check balance
        const receiverBalance = await usdt.balanceOf(TEST_RECEIVER);
        console.log("\nReceiver balance:", ethers.utils.formatUnits(receiverBalance, 6), "USDT");

    } catch (e) {
        console.log("✗ FAILED:", e.reason || e.message);

        // Debug the error
        if (e.message.includes("insufficient allowance")) {
            console.log("\n=== DEBUGGING ALLOWANCE ===");

            // Check if USDT uses non-standard allowance
            const allowanceData = await ethers.provider.call({
                to: USDT,
                data: usdt.interface.encodeFunctionData("allowance", [deployer.address, ROUTER])
            });
            console.log("Raw allowance data:", allowanceData);

            // Try to reset allowance to 0 first (some tokens require this)
            console.log("\nTrying to reset allowance to 0 first...");
            const resetTx = await usdt.approve(ROUTER, 0);
            await resetTx.wait();
            console.log("✓ Reset to 0");

            console.log("Now approving 1000 USDT...");
            const approveTx = await usdt.approve(ROUTER, ethers.utils.parseUnits("1000", 6));
            await approveTx.wait();
            console.log("✓ Approved 1000 USDT");

            const newAllowance = await usdt.allowance(deployer.address, ROUTER);
            console.log("New allowance:", ethers.utils.formatUnits(newAllowance, 6), "USDT");

            console.log("\nRetrying transfer...");
            try {
                const retryTx = await exchangeRouter.sendTokens(USDT, TEST_RECEIVER, testAmount);
                await retryTx.wait();
                console.log("✓ SUCCESS on retry!");
            } catch (e2) {
                console.log("✗ Still failing:", e2.reason || e2.message);
            }
        }
    }
}

main().catch(console.error);