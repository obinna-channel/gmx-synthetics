const { ethers } = require("hardhat");

async function main() {
    console.log("=== FIXING ROUTER ALLOWANCE ===\n");

    const [deployer] = await ethers.getSigners();

    const ROUTER = ethers.utils.getAddress("0x8209149be8c79b93c19efb0f92281b7c4b90fb75");
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);

    // Check current allowance
    const currentAllowance = await usdt.allowance(deployer.address, ROUTER);
    console.log("Current allowance to Router:", ethers.utils.formatUnits(currentAllowance, 6), "USDT");

    // We need fresh 100 USDT, but the previous 100 might still be counted in allowance
    // So let's set a higher allowance
    const NEW_ALLOWANCE = ethers.utils.parseUnits("200", 6); // 200 USDT to be safe

    console.log("\nSetting new allowance of 200 USDT to Router...");
    const approveTx = await usdt.approve(ROUTER, NEW_ALLOWANCE);
    await approveTx.wait();
    console.log("✓ Approved!");

    // Verify
    const newAllowance = await usdt.allowance(deployer.address, ROUTER);
    console.log("\nNew allowance to Router:", ethers.utils.formatUnits(newAllowance, 6), "USDT");

    console.log("\n✅ Router now has sufficient allowance.");
    console.log("You can now run the deposit script again.");
}

main().catch(console.error);