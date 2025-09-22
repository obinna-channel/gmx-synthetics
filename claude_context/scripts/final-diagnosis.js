const { ethers } = require("hardhat");

async function main() {
    console.log("=== FINAL DIAGNOSIS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    
    console.log("Current state:");
    console.log("- DepositVault has", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("- Market is registered in DataStore");
    console.log("- All pool parameters are set");
    console.log("- All roles are granted");
    console.log("- Prices are set");
    
    console.log("\nThe persistent 'Unauthorized' error suggests:");
    console.log("1. The market contract itself may not be properly initialized");
    console.log("2. There's a permission check we haven't identified");
    console.log("3. The market was created incorrectly by MarketFactory");
    
    console.log("\nRecommendations:");
    console.log("1. Deploy a fresh market using the exact GMX deployment process");
    console.log("2. Use an existing working market if available");
    console.log("3. Debug locally with a fork to trace the exact authorization check");
    
    console.log("\nThe 701 USDT in DepositVault can be recovered by:");
    console.log("- Having CONTROLLER role call the withdrawal functions");
    console.log("- Or redeploying with proper initialization");
}

main().catch(console.error);
