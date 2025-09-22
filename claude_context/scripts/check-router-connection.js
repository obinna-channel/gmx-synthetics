const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING ROUTER CONNECTION ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const EXPECTED_ROUTER = ethers.utils.getAddress("0x8209149be8c79b93c19efb0f92281b7c4b90fb75");

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    // ExchangeRouter inherits from BaseRouter which has a router variable
    // Let's check what router address the ExchangeRouter is using

    console.log("Expected Router address:", EXPECTED_ROUTER);

    // Try to read the router address from ExchangeRouter's storage
    // Router is the first state variable in BaseRouter, so it should be at slot 0
    const routerSlot = 0;
    const storageValue = await ethers.provider.getStorageAt(EXCHANGE_ROUTER, routerSlot);
    const actualRouter = "0x" + storageValue.slice(-40);

    console.log("Actual Router in ExchangeRouter:", actualRouter);

    if (actualRouter.toLowerCase() !== EXPECTED_ROUTER.toLowerCase()) {
        console.log("\n❌ PROBLEM FOUND!");
        console.log("ExchangeRouter is using a different Router contract!");
        console.log("This explains why the allowance isn't working.");
        console.log("\nYou've been approving:", EXPECTED_ROUTER);
        console.log("But ExchangeRouter uses:", actualRouter);

        // Check allowance to the actual router
        const [deployer] = await ethers.getSigners();
        const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
        const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);

        const allowanceToActual = await usdt.allowance(deployer.address, actualRouter);
        console.log("\nAllowance to actual Router:", ethers.utils.formatUnits(allowanceToActual, 6), "USDT");

        if (allowanceToActual.eq(0)) {
            console.log("\n=== SOLUTION ===");
            console.log("Approve the actual Router that ExchangeRouter uses:");
            console.log(`await usdt.approve("${actualRouter}", amount)`);
        }
    } else {
        console.log("\n✓ ExchangeRouter is using the correct Router");
        console.log("The issue must be elsewhere...");
    }
}

main().catch(console.error);