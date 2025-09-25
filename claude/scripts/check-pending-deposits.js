const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking for Pending Deposits ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check DEPOSIT_LIST
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );

    const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
    console.log("Number of pending deposits:", depositCount.toString());

    if (depositCount.gt(0)) {
        console.log("\n📍 Pending deposits found:");
        for (let i = 0; i < depositCount.toNumber(); i++) {
            const depositKey = await dataStore.getBytes32ValuesAt(DEPOSIT_LIST, i, i + 1);
            console.log(`  ${i + 1}. ${depositKey[0]}`);
        }
    } else {
        console.log("✅ No pending deposits");
    }

    // Check vault balances
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);
    const weth = await ethers.getContractAt("IERC20", WETH);

    console.log("\n📊 Vault balances:");
    const usdtBal = await usdt.balanceOf(DEPOSIT_VAULT);
    const sngnBal = await sngn.balanceOf(DEPOSIT_VAULT);
    const wethBal = await weth.balanceOf(DEPOSIT_VAULT);

    console.log("  USDT:", ethers.utils.formatUnits(usdtBal, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(sngnBal, 18));
    console.log("  WETH:", ethers.utils.formatEther(wethBal));

    if (usdtBal.gt(0) || sngnBal.gt(0) || wethBal.gt(0)) {
        console.log("\n⚠️  Vault has tokens - might have stale deposits");
    }
}

main().catch(console.error);