const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING DEPOSIT ALLOWANCE ISSUE ===\n");

    const [deployer] = await ethers.getSigners();

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        ROUTER: ethers.utils.getAddress("0x8209149be8c79b93c19efb0f92281b7c4b90fb75"),
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"
    };

    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", ADDRESSES.USDT);
    const DEPOSIT_AMOUNT = ethers.utils.parseUnits("100", 6);

    console.log("Deployer address:", deployer.address);
    console.log("Deposit amount: 100 USDT\n");

    // Check all relevant allowances
    console.log("=== CURRENT ALLOWANCES ===");

    const allowanceToRouter = await usdt.allowance(deployer.address, ADDRESSES.ROUTER);
    console.log(`Deployer → Router: ${ethers.utils.formatUnits(allowanceToRouter, 6)} USDT`);

    const allowanceToExchangeRouter = await usdt.allowance(deployer.address, ADDRESSES.EXCHANGE_ROUTER);
    console.log(`Deployer → ExchangeRouter: ${ethers.utils.formatUnits(allowanceToExchangeRouter, 6)} USDT`);

    const allowanceToDepositVault = await usdt.allowance(deployer.address, ADDRESSES.DEPOSIT_VAULT);
    console.log(`Deployer → DepositVault: ${ethers.utils.formatUnits(allowanceToDepositVault, 6)} USDT`);

    // Check balances
    console.log("\n=== CURRENT BALANCES ===");

    const deployerBalance = await usdt.balanceOf(deployer.address);
    console.log(`Deployer: ${ethers.utils.formatUnits(deployerBalance, 6)} USDT`);

    const routerBalance = await usdt.balanceOf(ADDRESSES.ROUTER);
    console.log(`Router: ${ethers.utils.formatUnits(routerBalance, 6)} USDT`);

    const exchangeRouterBalance = await usdt.balanceOf(ADDRESSES.EXCHANGE_ROUTER);
    console.log(`ExchangeRouter: ${ethers.utils.formatUnits(exchangeRouterBalance, 6)} USDT`);

    const depositVaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log(`DepositVault: ${ethers.utils.formatUnits(depositVaultBalance, 6)} USDT`);

    console.log("\n=== TESTING DIRECT TRANSFER ===");

    // Test if we can transfer directly to DepositVault
    try {
        console.log("Testing direct transfer to DepositVault...");
        const testAmount = ethers.utils.parseUnits("1", 6); // 1 USDT test
        const tx = await usdt.transfer(ADDRESSES.DEPOSIT_VAULT, testAmount);
        await tx.wait();
        console.log("✓ Direct transfer successful");

        const newVaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
        console.log(`DepositVault new balance: ${ethers.utils.formatUnits(newVaultBalance, 6)} USDT`);
    } catch (e) {
        console.log("✗ Direct transfer failed:", e.message);
    }

    console.log("\n=== SOLUTION ===");
    console.log("The issue is that Router needs approval to transfer your tokens.");
    console.log("When you call ExchangeRouter.sendTokens():");
    console.log("  1. ExchangeRouter calls Router.pluginTransfer()");
    console.log("  2. Router transfers tokens from YOU to DepositVault");
    console.log("  3. So ROUTER needs approval from you, not ExchangeRouter");

    if (allowanceToRouter.lt(DEPOSIT_AMOUNT)) {
        console.log("\n❌ Need to approve Router for at least 100 USDT");
        console.log("\nApproving Router now...");

        const approveTx = await usdt.approve(ADDRESSES.ROUTER, DEPOSIT_AMOUNT);
        await approveTx.wait();
        console.log("✓ Approved Router for 100 USDT");

        const newAllowance = await usdt.allowance(deployer.address, ADDRESSES.ROUTER);
        console.log(`New allowance: ${ethers.utils.formatUnits(newAllowance, 6)} USDT`);
    } else {
        console.log("\n✓ Router already has sufficient approval");
    }
}

main().catch(console.error);