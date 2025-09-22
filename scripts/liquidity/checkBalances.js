const { ethers } = require("hardhat");

async function main() {
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";

    const usdt = await ethers.getContractAt("IERC20", USDT);

    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const routerBalance = await usdt.balanceOf(EXCHANGE_ROUTER);
    const [signer] = await ethers.getSigners();
    const signerBalance = await usdt.balanceOf(signer.address);

    console.log("DepositVault USDT:", ethers.utils.formatUnits(vaultBalance, 6));
    console.log("ExchangeRouter USDT:", ethers.utils.formatUnits(routerBalance, 6));
    console.log("Your USDT:", ethers.utils.formatUnits(signerBalance, 6));
    console.log("\nTotal locked in system:", ethers.utils.formatUnits(vaultBalance.add(routerBalance), 6));
}

main().catch(console.error);
