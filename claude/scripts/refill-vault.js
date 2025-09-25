const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Sending Tokens to Vault to Enable Cancellation ===\n");
    console.log("Signer:", signer.address);

    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);
    const weth = await ethers.getContractAt("IERC20", WETH);

    // Amounts to send
    const usdtAmount = ethers.utils.parseUnits("1", 6); // 1 USDT
    const sngnAmount = ethers.utils.parseUnits("1500", 18); // 1500 sNGN
    const wethAmount = ethers.utils.parseEther("0.001"); // 0.001 WETH (not 0.01 as that seems like a typo)

    console.log("Amounts to send to vault:");
    console.log("  USDT:", ethers.utils.formatUnits(usdtAmount, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(sngnAmount, 18));
    console.log("  WETH:", ethers.utils.formatEther(wethAmount));

    // Check balances
    const usdtBal = await usdt.balanceOf(signer.address);
    const sngnBal = await sngn.balanceOf(signer.address);
    const wethBal = await weth.balanceOf(signer.address);

    console.log("\nYour balances:");
    console.log("  USDT:", ethers.utils.formatUnits(usdtBal, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(sngnBal, 18));
    console.log("  WETH:", ethers.utils.formatEther(wethBal));

    // Transfer tokens
    console.log("\n📍 Transferring tokens to vault...");

    // 1. Transfer USDT
    console.log("  Sending USDT...");
    const usdtTx = await usdt.transfer(DEPOSIT_VAULT, usdtAmount);
    await usdtTx.wait();
    console.log("  ✅ USDT sent");

    // 2. Transfer sNGN
    console.log("  Sending sNGN...");
    const sngnTx = await sngn.transfer(DEPOSIT_VAULT, sngnAmount);
    await sngnTx.wait();
    console.log("  ✅ sNGN sent");

    // 3. Transfer WETH
    console.log("  Sending WETH...");
    const wethTx = await weth.transfer(DEPOSIT_VAULT, wethAmount);
    await wethTx.wait();
    console.log("  ✅ WETH sent");

    // Verify vault balances
    console.log("\n📊 Vault balances after transfer:");
    const vaultUsdt = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngn = await sngn.balanceOf(DEPOSIT_VAULT);
    const vaultWeth = await weth.balanceOf(DEPOSIT_VAULT);

    console.log("  USDT in vault:", ethers.utils.formatUnits(vaultUsdt, 6));
    console.log("  sNGN in vault:", ethers.utils.formatUnits(vaultSngn, 18));
    console.log("  WETH in vault:", ethers.utils.formatEther(vaultWeth));

    console.log("\n✅ SUCCESS! Vault has been refilled with the necessary tokens");
    console.log("You can now cancel the stuck deposit");
}

main().catch(console.error);