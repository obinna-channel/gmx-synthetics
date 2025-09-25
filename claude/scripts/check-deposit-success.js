const { ethers } = require("hardhat");

async function main() {
    const txHash = "0xa4a2c4e90acef70a702a9e495116ee40d6617c1d2731e573e8ccb6f3602b1701";
    console.log("=== Checking Successful Deposit Transaction ===\n");

    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);

    console.log("Transaction:", txHash);
    console.log("Status:", receipt.status ? "SUCCESS ✅" : "FAILED ❌");
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Block:", receipt.blockNumber);

    // Decode logs
    console.log("\nLogs emitted:", receipt.logs.length);

    // Check DataStore for deposits
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    const signer = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";
    const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
    );
    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ACCOUNT_DEPOSIT_LIST, signer]
        )
    );

    const depositCount = await dataStore.getBytes32Count(accountKey);
    console.log("\nTotal deposits for account:", depositCount.toString());

    if (depositCount.gt(0)) {
        const deposits = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);
        console.log("\nDeposit keys:");
        deposits.forEach((key, i) => {
            console.log(`  ${i + 1}. ${key}`);
        });

        // Get the latest deposit key
        const latestDepositKey = deposits[deposits.length - 1];
        console.log("\n🎉 LATEST DEPOSIT KEY:", latestDepositKey);

        // Try to get deposit details
        const DEPOSIT = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT"])
        );
        const depositDataKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "bytes32"],
                [DEPOSIT, latestDepositKey]
            )
        );

        // Get deposit addresses
        const depositAddresses = await dataStore.getAddressArray(depositDataKey);
        if (depositAddresses.length > 0) {
            console.log("\nDeposit details found!");
            console.log("  Account:", depositAddresses[0]);
            console.log("  Receiver:", depositAddresses[1]);
            if (depositAddresses[2]) console.log("  Callback Contract:", depositAddresses[2]);
            if (depositAddresses[3]) console.log("  UI Fee Receiver:", depositAddresses[3]);
            if (depositAddresses[4]) console.log("  Market:", depositAddresses[4]);
            if (depositAddresses[5]) console.log("  Initial Long Token:", depositAddresses[5]);
            if (depositAddresses[6]) console.log("  Initial Short Token:", depositAddresses[6]);
        }

        // Get deposit numbers
        const depositNumbers = await dataStore.getUintArray(depositDataKey);
        if (depositNumbers.length > 0) {
            console.log("\nDeposit amounts:");
            if (depositNumbers[0]) console.log("  Long Token Amount:", depositNumbers[0].toString());
            if (depositNumbers[1]) console.log("  Short Token Amount:", depositNumbers[1].toString());
            if (depositNumbers[2]) console.log("  Min Market Tokens:", depositNumbers[2].toString());
            if (depositNumbers[3]) console.log("  Updated At Time:", new Date(depositNumbers[3].toNumber() * 1000).toISOString());
            if (depositNumbers[4]) console.log("  Execution Fee:", ethers.utils.formatEther(depositNumbers[4]));
        }

        console.log("\n✅ DEPOSIT SUCCESSFULLY CREATED AND STORED IN DATASTORE!");
        console.log("The deposit is now waiting for keeper execution.");
    } else {
        console.log("\n⚠️  No deposits found in DataStore");
    }

    // Check vault balances
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const sngn = await ethers.getContractAt("IERC20", sNGN);

    const vaultUsdtBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const vaultSngnBalance = await sngn.balanceOf(DEPOSIT_VAULT);

    console.log("\nDepositVault balances:");
    console.log("  USDT:", ethers.utils.formatUnits(vaultUsdtBalance, 6));
    console.log("  sNGN:", ethers.utils.formatUnits(vaultSngnBalance, 18));
}

main().catch(console.error);