const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING EXACT ALLOWANCE STATE ===\n");

    const [deployer] = await ethers.getSigners();
    const ROUTER = ethers.utils.getAddress("0x8209149be8c79b93c19efb0f92281b7c4b90fb75");
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);

    const allowance = await usdt.allowance(deployer.address, ROUTER);
    const DEPOSIT_AMOUNT = ethers.utils.parseUnits("100", 6);

    console.log("Exact allowance (raw):", allowance.toString());
    console.log("Exact allowance (formatted):", ethers.utils.formatUnits(allowance, 6), "USDT");
    console.log("\nDeposit amount (raw):", DEPOSIT_AMOUNT.toString());
    console.log("Deposit amount (formatted):", ethers.utils.formatUnits(DEPOSIT_AMOUNT, 6), "USDT");

    console.log("\n=== COMPARISON ===");
    if (allowance.eq(DEPOSIT_AMOUNT)) {
        console.log("Allowance EXACTLY equals deposit amount");
        console.log("\nThis might fail because:");
        console.log("1. Some contracts check for allowance > amount (not >=)");
        console.log("2. There might be rounding in the contract");
        console.log("3. Previous failed transactions might have partially consumed allowance");
    } else if (allowance.lt(DEPOSIT_AMOUNT)) {
        console.log("Allowance is LESS than deposit amount");
        console.log(`Shortfall: ${ethers.utils.formatUnits(DEPOSIT_AMOUNT.sub(allowance), 6)} USDT`);
    } else {
        console.log("Allowance is GREATER than deposit amount");
        console.log(`Excess: ${ethers.utils.formatUnits(allowance.sub(DEPOSIT_AMOUNT), 6)} USDT`);
    }

    // Check if any allowance was consumed
    console.log("\n=== CHECKING FOR CONSUMED ALLOWANCE ===");
    console.log("If you approved 100 USDT initially and it shows 100 USDT now,");
    console.log("then NO allowance was consumed in failed transactions.");
    console.log("\nThe issue is likely that the contract needs allowance > amount,");
    console.log("not allowance >= amount, which is why 200 USDT allowance should work.");
}

main().catch(console.error);