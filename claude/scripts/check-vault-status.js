const { ethers } = require("hardhat");

async function main() {
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

    console.log("=== Checking Vault and DataStore Status ===\n");

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);

    // Check vault balances
    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);

    console.log("DepositVault balances:");
    console.log("  USDT:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(vaultSngnBalance, 18));

    // Check tokenBalances mapping in vault (if accessible)
    try {
        const usdtTokenBalance = await depositVault.tokenBalances(USDT);
        const sngnTokenBalance = await depositVault.tokenBalances(sNGN);
        console.log("\nVault's internal tokenBalances:");
        console.log("  USDT:", ethers.utils.formatUnits(usdtTokenBalance, 6));
        console.log("  sNGN:", ethers.utils.formatUnits(sngnTokenBalance, 18));
    } catch (e) {
        console.log("\nCouldn't read tokenBalances mapping");
    }

    // Check deposit count
    const [signer] = await ethers.getSigners();
    const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
    );
    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ACCOUNT_DEPOSIT_LIST, signer.address]
        )
    );

    const depositCount = await dataStore.getBytes32Count(accountKey);
    console.log("\nTotal deposits for account:", depositCount.toString());

    if (depositCount.gt(0)) {
        const deposits = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
        console.log("Deposit keys:");
        deposits.forEach((key, i) => {
            console.log(`  ${i + 1}. ${key}`);
        });

        // Check last deposit status
        const lastDepositKey = deposits[deposits.length - 1];
        const DEPOSIT = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT"])
        );

        const depositDataKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "bytes32"],
                [DEPOSIT, lastDepositKey]
            )
        );

        // Try to get deposit data
        const depositAddresses = await dataStore.getAddressArray(depositDataKey);
        if (depositAddresses.length > 0) {
            console.log("\nLast deposit data found!");
            console.log("  Account:", depositAddresses[0]);
            console.log("  Receiver:", depositAddresses[1]);
        } else {
            console.log("\nNo deposit data found for last key");
        }
    }
}

main().catch(console.error);