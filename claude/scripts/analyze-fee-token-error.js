const { ethers } = require("hardhat");

async function main() {
    console.log("=== Analyzing Fee Token Error ===\n");

    // The error data
    const errorSig = "0x979dc780"; // InsufficientFeeTokenAmount
    const token = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6"; // USDT
    const account = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    const amount = "1000000"; // 1 USDT (with 6 decimals)

    console.log("Error: InsufficientFeeTokenAmount");
    console.log("Token:", token, "(USDT)");
    console.log("Account:", account);
    console.log("Amount:", amount, "= 1.0 USDT");

    console.log("\n❓ This is confusing because:");
    console.log("1. WETH should be the execution fee token, not USDT");
    console.log("2. The error name suggests it's about fee tokens");
    console.log("3. But it's complaining about USDT");

    console.log("\n💡 Possible explanations:");
    console.log("1. The error name 'InsufficientFeeTokenAmount' might be misleading");
    console.log("2. It could be trying to refund the deposit tokens (USDT), not just the fee");
    console.log("3. The deposit might have had 1 USDT deposited before it got corrupted");

    // Let's check the vault balances
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const weth = await ethers.getContractAt("IERC20", WETH);

    const usdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const wethBalance = await weth.balanceOf(DEPOSIT_VAULT);

    console.log("\n📊 Current vault balances:");
    console.log("  USDT:", ethers.utils.formatUnits(usdtBalance, 6));
    console.log("  WETH:", ethers.utils.formatEther(wethBalance));

    console.log("\n📝 To fix this:");
    console.log("Since the cancellation wants to refund 1 USDT,");
    console.log("we could transfer 1 USDT to the vault first,");
    console.log("then try to cancel the deposit again.");
}

main().catch(console.error);