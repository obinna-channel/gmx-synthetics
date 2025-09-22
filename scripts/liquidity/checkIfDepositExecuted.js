const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING IF DEPOSIT WAS ALREADY EXECUTED ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"
    };

    const [signer] = await ethers.getSigners();
    console.log("Your address:", signer.address);

    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);
    const marketToken = await ethers.getContractAt("IERC20", ADDRESSES.MARKET);
    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);

    console.log("=== CHECKING GM TOKEN BALANCE ===");
    const gmBalance = await marketToken.balanceOf(signer.address);
    console.log("Your GM token balance:", ethers.utils.formatEther(gmBalance), "GM");

    if (gmBalance.gt(0)) {
        console.log("✅ You have GM tokens! The deposit was likely executed.");
    } else {
        console.log("❌ No GM tokens. Deposit not executed or failed.");
    }

    console.log("\n=== CHECKING POOL STATE ===");
    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["address", "address", "bytes32"],
            [ADDRESSES.MARKET, ADDRESSES.USDT, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT"))]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("USDT in pool:", ethers.utils.formatUnits(poolAmount, 6), "USDT");

    if (poolAmount.gt(0)) {
        console.log("✅ Pool has USDT! Liquidity was added.");
    } else {
        console.log("❌ Pool is empty. No liquidity added yet.");
    }

    const totalSupply = await marketToken.totalSupply();
    console.log("Total GM supply:", ethers.utils.formatEther(totalSupply), "GM");

    console.log("\n=== CHECKING VAULT STATE ===");
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("USDT in DepositVault:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    console.log("\n=== ANALYSIS ===");

    if (gmBalance.gt(0) && poolAmount.gt(0)) {
        console.log("🎉 SUCCESS! The deposit was executed!");
        console.log("You successfully added liquidity to the USDTNGN market.");
        console.log("You received", ethers.utils.formatEther(gmBalance), "GM tokens.");
    } else if (poolAmount.gt(0) && gmBalance.eq(0)) {
        console.log("🤔 Pool has liquidity but you have no GM tokens.");
        console.log("The deposit might have been executed by someone else or with a different receiver.");
    } else if (vaultBalance.gt(ethers.utils.parseUnits("1066", 6))) {
        console.log("⏳ Deposit not executed yet.");
        console.log("The USDT is still in the vault waiting for execution.");
        console.log("But the deposit record doesn't exist - it might have expired or been cancelled.");
    } else {
        console.log("❓ Unclear state.");
        console.log("Need to investigate further what happened to the deposit.");
    }

    // Check for any pending deposits with the known key
    const depositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";
    const accountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "bytes32"],
            [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
        )
    );

    const depositAccount = await dataStore.getAddress(accountKey);
    console.log("\n=== DEPOSIT KEY STATUS ===");
    console.log("Checking key:", depositKey);
    if (depositAccount === ethers.constants.AddressZero) {
        console.log("❌ No deposit exists with this key");
        console.log("It was either executed, cancelled, or expired");
    } else {
        console.log("✅ Deposit still exists for account:", depositAccount);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });