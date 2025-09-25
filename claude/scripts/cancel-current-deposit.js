const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Cancelling Current Deposit (Properly) ===\n");

    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const depositKey = "0x12c0b3982ec25d66ac8a28e3ad6d6a8a8b71255c41f53fea57eb94a107913196";

    console.log("Deposit Key:", depositKey);
    console.log("Signer:", signer.address);
    console.log("\n⚠️  Using depositHandler.cancelDeposit() - the PROPER way");

    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check deposit exists before
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const beforeInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
    console.log("\nDeposit in list before cancel:", beforeInList ? "YES ✅" : "NO ❌");

    if (!beforeInList) {
        console.log("❌ Deposit not found in list!");
        return;
    }

    // Check vault balances before
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);
    const weth = await ethers.getContractAt("IERC20", WETH);

    console.log("\n📊 Vault balances before cancel:");
    console.log("  USDT:", ethers.utils.formatUnits(await usdt.balanceOf(DEPOSIT_VAULT), 6));
    console.log("  sNGN:", ethers.utils.formatUnits(await sngn.balanceOf(DEPOSIT_VAULT), 18));
    console.log("  WETH:", ethers.utils.formatEther(await weth.balanceOf(DEPOSIT_VAULT)));

    try {
        console.log("\n📍 Cancelling deposit using depositHandler.cancelDeposit()...");
        const tx = await depositHandler.cancelDeposit(depositKey, {
            gasLimit: 1000000
        });

        console.log("  Transaction sent:", tx.hash);
        console.log("  Waiting for confirmation...");

        const receipt = await tx.wait();
        console.log("\n✅ Deposit cancelled successfully!");
        console.log("  Block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());
        console.log("  Status:", receipt.status === 1 ? "SUCCESS ✅" : "FAILED ❌");

        // Check if removed from list
        const afterInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
        console.log("\nDeposit in list after cancel:", afterInList ? "YES ❌ (still there)" : "NO ✅ (removed)");

        // Check deposit count
        const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
        console.log("Total deposits in queue now:", depositCount.toString());

        // Check vault balances after
        console.log("\n📊 Vault balances after cancel:");
        console.log("  USDT:", ethers.utils.formatUnits(await usdt.balanceOf(DEPOSIT_VAULT), 6));
        console.log("  sNGN:", ethers.utils.formatUnits(await sngn.balanceOf(DEPOSIT_VAULT), 18));
        console.log("  WETH:", ethers.utils.formatEther(await weth.balanceOf(DEPOSIT_VAULT)));

        console.log("\n📊 View on Arbiscan:");
        console.log("https://sepolia.arbiscan.io/tx/" + tx.hash);

        console.log("\n✅ SUCCESS! Deposit properly cancelled using depositHandler!");
        console.log("You should have received back:");
        console.log("  - 1 USDT");
        console.log("  - 1500 sNGN");
        console.log("  - 0.001 WETH (execution fee)");

    } catch (error) {
        console.log("\n❌ Cancellation failed!");
        console.log("Error:", error.message);

        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);