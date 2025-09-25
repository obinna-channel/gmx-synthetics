const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING WITH EXCHANGE ROUTER APPROVAL ===\n");

    const [deployer] = await ethers.getSigners();
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";

    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    // Check current allowance to ExchangeRouter
    const currentAllowance = await usdt.allowance(deployer.address, EXCHANGE_ROUTER);
    console.log("Current allowance to ExchangeRouter:", ethers.utils.formatUnits(currentAllowance, 6), "USDT");

    if (currentAllowance.lt(ethers.utils.parseUnits("100", 6))) {
        console.log("\nApproving ExchangeRouter for 100 USDT...");
        const approveTx = await usdt.approve(EXCHANGE_ROUTER, ethers.utils.parseUnits("100", 6));
        await approveTx.wait();
        console.log("✓ Approved!");
    }

    console.log("\n=== ATTEMPTING TRANSFER ===");
    const transferAmount = ethers.utils.parseUnits("1", 6);

    try {
        console.log("Calling ExchangeRouter.sendTokens...");
        const tx = await exchangeRouter.sendTokens(USDT, DEPOSIT_VAULT, transferAmount);
        const receipt = await tx.wait();
        console.log("✓ SUCCESS! Transfer worked!");
        console.log("  Tx hash:", receipt.transactionHash);

        const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
        console.log("\nDepositVault balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    } catch (e) {
        console.log("✗ Failed:", e.reason || e.message);

        // The issue might be that sendTokens expects the tokens to come from msg.sender
        // but uses Router for the actual transfer
        console.log("\n=== ANALYSIS ===");
        console.log("The sendTokens function flow:");
        console.log("1. ExchangeRouter.sendTokens is called by us");
        console.log("2. It calls router.pluginTransfer(token, msg.sender, receiver, amount)");
        console.log("3. Router needs allowance from msg.sender (us)");
        console.log("\nBut we already gave Router 1000 USDT allowance!");
        console.log("This suggests there might be a bug in the contract or deployment.");
    }
}

main().catch(console.error);