const { ethers } = require("hardhat");

async function main() {
    console.log("=== FINDING CORRECT ROUTER ADDRESS ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";

    // Check multiple storage slots to find the Router address
    console.log("Checking storage slots for Router address pattern...\n");

    for (let i = 0; i < 10; i++) {
        const storageValue = await ethers.provider.getStorageAt(EXCHANGE_ROUTER, i);
        console.log(`Slot ${i}: ${storageValue}`);

        // Check if it looks like an address (has 0x prefix pattern after padding)
        if (storageValue !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
            const possibleAddress = "0x" + storageValue.slice(-40);
            console.log(`  -> Possible address: ${possibleAddress}`);
        }
    }

    // Actually, let's just call the router() function directly
    console.log("\n=== CALLING router() FUNCTION ===");

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    // ExchangeRouter inherits from BaseRouter which has a public router() function
    try {
        // Get the Router interface and use it
        const baseRouterABI = [
            "function router() external view returns (address)"
        ];
        const exchangeRouterWithABI = new ethers.Contract(EXCHANGE_ROUTER, baseRouterABI, ethers.provider);

        const routerAddress = await exchangeRouterWithABI.router();
        console.log("Router address from router() function:", routerAddress);

        // Now check our allowance to this router
        const [deployer] = await ethers.getSigners();
        const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
        const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);

        const allowance = await usdt.allowance(deployer.address, routerAddress);
        console.log("\nYour allowance to this Router:", ethers.utils.formatUnits(allowance, 6), "USDT");

        if (allowance.eq(0)) {
            console.log("\n❌ THIS IS THE PROBLEM!");
            console.log("You need to approve this Router address!");

            console.log("\n=== FIXING THE ISSUE ===");
            const approveAmount = ethers.utils.parseUnits("1000", 6);
            console.log("Approving correct Router for 1000 USDT...");

            const approveTx = await usdt.approve(routerAddress, approveAmount);
            await approveTx.wait();
            console.log("✓ Approved!");

            const newAllowance = await usdt.allowance(deployer.address, routerAddress);
            console.log("New allowance:", ethers.utils.formatUnits(newAllowance, 6), "USDT");
        }

    } catch (e) {
        console.log("Error calling router():", e.message);
    }
}

main().catch(console.error);