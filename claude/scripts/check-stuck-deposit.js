const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Stuck Deposit Details ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);

    // Check deposit details
    const ACCOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT"])),
                depositKey
            ]
        )
    );

    const MARKET_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "bytes32"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT"])),
                depositKey,
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET"]))
            ]
        )
    );

    const account = await dataStore.getAddress(ACCOUNT_KEY);
    const market = await dataStore.getAddress(MARKET_KEY);

    console.log("Stuck deposit key:", depositKey);
    console.log("Account (creator):", account);
    console.log("Market:", market);

    // Check vault WETH balance and recorded balance
    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";
    const weth = await ethers.getContractAt("IERC20", WETH);
    const wethBalance = await weth.balanceOf(DEPOSIT_VAULT);
    const recordedWeth = await depositVault.tokenBalances(WETH);

    console.log("\nVault WETH status:");
    console.log("  Actual balance:", ethers.utils.formatEther(wethBalance));
    console.log("  Recorded balance:", ethers.utils.formatEther(recordedWeth));

    if (wethBalance.gt(recordedWeth)) {
        console.log("  ⚠️ Mismatch - actual > recorded. Need to sync!");
    }

    // Check if we can clear it
    const [signer] = await ethers.getSigners();
    console.log("\nCurrent signer:", signer.address);

    if (account === ethers.constants.AddressZero) {
        console.log("❌ Deposit account is zero address - deposit might be corrupted");
    } else if (account.toLowerCase() === signer.address.toLowerCase()) {
        console.log("✅ You created this deposit - you should be able to cancel it");
    } else {
        console.log("⚠️ Someone else created this deposit");
    }
}

main().catch(console.error);