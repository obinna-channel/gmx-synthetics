const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING VAULT TOKEN BALANCES ===\n");

    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);
    
    // Check actual balance
    const actualBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("Actual USDT balance in vault:", ethers.utils.formatUnits(actualBalance, 6));
    
    // Check recorded balance (what the vault thinks it has)
    const recordedBalance = await depositVault.tokenBalances(USDT);
    console.log("Recorded USDT balance:", ethers.utils.formatUnits(recordedBalance, 6));
    
    const difference = actualBalance.sub(recordedBalance);
    console.log("Unrecorded tokens:", ethers.utils.formatUnits(difference, 6));
    
    if (difference.eq(0)) {
        console.log("\n❌ PROBLEM: No new tokens to record!");
        console.log("recordTransferIn() expects NEW tokens since last recorded balance.");
        console.log("But all tokens were already recorded when we sent them.");
        console.log("\nThis is why deposits are failing!");
        console.log("\nSolution: We need to send tokens and create deposit in ONE transaction.");
        console.log("This is why the deployment scripts use multicall!");
    }
}

main().catch(console.error);
