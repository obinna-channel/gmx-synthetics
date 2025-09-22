const { ethers } = require("hardhat");

async function main() {
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    
    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT);
    const balance = await usdt.balanceOf(DEPOSIT_VAULT);
    
    console.log("DepositVault USDT balance:", ethers.utils.formatUnits(balance, 6), "USDT");
}

main().catch(console.error);
