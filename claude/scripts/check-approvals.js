const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const ROUTER = "0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    const usdtBal = await usdt.balanceOf(signer.address);
    const sngnBal = await sngn.balanceOf(signer.address);
    const usdtAllow = await usdt.allowance(signer.address, ROUTER);
    const sngnAllow = await sngn.allowance(signer.address, ROUTER);

    console.log("=== Token Balances & Approvals ===\n");
    console.log("USDT Balance:", ethers.utils.formatUnits(usdtBal, 6));
    console.log("sNGN Balance:", ethers.utils.formatUnits(sngnBal, 18));
    console.log("\nRouter Approvals:");
    console.log("USDT Allowance:", ethers.utils.formatUnits(usdtAllow, 6));
    console.log("sNGN Allowance:", ethers.utils.formatUnits(sngnAllow, 18));

    console.log("\nNeeded for deposit:");
    console.log("USDT: 1.0");
    console.log("sNGN: 1500.0");

    if (usdtAllow.lt(ethers.utils.parseUnits("1", 6))) {
        console.log("\n❌ USDT allowance insufficient!");
    }
    if (sngnAllow.lt(ethers.utils.parseUnits("1500", 18))) {
        console.log("❌ sNGN allowance insufficient!");
    }
}
main().catch(console.error);