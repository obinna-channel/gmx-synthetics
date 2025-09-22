const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== Resetting Pool Back to Zero ===");

    const [signer] = await ethers.getSigners();

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== Current State ===");

    // Check current pool amount
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );

    const currentPoolAmount = await dataStore.getUint(poolAmountKey);
    console.log("Current USDT pool amount:", currentPoolAmount.toString());
    console.log("In USDT:", ethers.utils.formatUnits(currentPoolAmount, 6));

    // Check USDT in DepositVault
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("\nUSDT in DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    console.log("\n=== Resetting Pool to Zero ===");

    if (currentPoolAmount.gt(0)) {
        console.log("Setting pool amount back to 0...");
        const tx = await dataStore.setUint(poolAmountKey, 0);
        await tx.wait();
        console.log("✅ Pool amount reset to 0!");
    } else {
        console.log("✅ Pool amount is already 0");
    }

    // Verify the reset
    const verifyPoolAmount = await dataStore.getUint(poolAmountKey);
    console.log("\nVerification - Pool amount:", verifyPoolAmount.toString());

    console.log("\n=== Summary ===");
    console.log("✅ Pool has been reset to zero");
    console.log("✅ The market is now in a clean state for first deposit");
    console.log("\nCurrent situation:");
    console.log("- Pool amount: 0 USDT");
    console.log("- DepositVault: " + ethers.utils.formatUnits(vaultBalance, 6) + " USDT (waiting to be deposited)");
    console.log("- Market token supply: 0 GM tokens");
    console.log("\nThe pool is ready for a proper first deposit!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });