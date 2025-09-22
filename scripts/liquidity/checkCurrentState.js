const { ethers } = require("hardhat");

async function main() {
    console.log("\n=== CHECKING CURRENT STATE ===");

    const [signer] = await ethers.getSigners();

    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const marketToken = await ethers.getContractAt("IERC20", MARKET);

    console.log("\n=== Vault Balances ===");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("USDT in DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    console.log("\n=== Your Balances ===");
    const signerUSDT = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(signerUSDT, 6), "USDT");

    const signerGM = await marketToken.balanceOf(signer.address);
    console.log("Your GM token balance:", ethers.utils.formatEther(signerGM), "GM");

    console.log("\n=== Pool State ===");
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [MARKET, USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("USDT pool amount:", ethers.utils.formatUnits(poolAmount, 6), "USDT");

    const totalSupply = await marketToken.totalSupply();
    console.log("GM token total supply:", ethers.utils.formatEther(totalSupply), "GM");

    console.log("\n=== Summary ===");
    if (vaultBalance.gt(0)) {
        console.log("✅ USDT is still in the vault");
        console.log("The deposit was likely cancelled but funds weren't returned properly");
        console.log("Or the deposit key expired");
    } else if (poolAmount.gt(0)) {
        console.log("✅ USDT is in the pool - deposit was executed successfully!");
    } else if (signerUSDT.gt(0)) {
        console.log("✅ USDT was returned to your wallet");
    } else {
        console.log("❌ USDT location unknown - may need to check other addresses");
    }

    console.log("\n=== Next Steps ===");
    if (vaultBalance.gt(0)) {
        console.log("1. Create a new deposit with the USDT in the vault");
        console.log("2. Make sure to use executionFee = 0");
        console.log("3. Execute the new deposit");
    } else if (poolAmount.eq(0) && totalSupply.eq(0)) {
        console.log("1. Transfer USDT to create a new deposit");
        console.log("2. Create deposit with executionFee = 0");
        console.log("3. Execute the deposit");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });