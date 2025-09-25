const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Storage Everywhere ===\n");

    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const DEPOSIT_VAULT = "0x8672091de3AF3a02bE48cFB753810A736D9F6379";
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("Deposit key:", depositKey);

    // 1. Check DEPOSIT_LIST
    console.log("\n📍 1. DEPOSIT_LIST in DataStore:");
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const isInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
    console.log("  In DEPOSIT_LIST:", isInList ? "YES ✅" : "NO ❌");

    // 2. Check deposit data fields in DataStore
    console.log("\n📍 2. Deposit data fields in DataStore:");

    // Base key for deposit
    const DEPOSIT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT"])
    );

    // Check account
    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32"],
            [DEPOSIT_KEY, depositKey]
        )
    );
    const account = await dataStore.getAddress(accountKey);
    console.log("  Account:", account);

    // Check market
    const marketKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "bytes32"],
            [DEPOSIT_KEY, depositKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET"]))]
        )
    );
    const market = await dataStore.getAddress(marketKey);
    console.log("  Market:", market);

    // Check amounts
    const longAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "bytes32"],
            [DEPOSIT_KEY, depositKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_LONG_TOKEN_AMOUNT"]))]
        )
    );
    const longAmount = await dataStore.getUint(longAmountKey);
    console.log("  Long token amount:", longAmount.toString());

    const shortAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "bytes32"],
            [DEPOSIT_KEY, depositKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_SHORT_TOKEN_AMOUNT"]))]
        )
    );
    const shortAmount = await dataStore.getUint(shortAmountKey);
    console.log("  Short token amount:", shortAmount.toString());

    // Check execution fee
    const execFeeKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "bytes32", "bytes32"],
            [DEPOSIT_KEY, depositKey, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["EXECUTION_FEE"]))]
        )
    );
    const execFee = await dataStore.getUint(execFeeKey);
    console.log("  Execution fee:", ethers.utils.formatEther(execFee));

    // 3. Check DepositVault recorded balances (already done)
    console.log("\n📍 3. DepositVault balances:");
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";
    const wethRecorded = await depositVault.tokenBalances(WETH);
    console.log("  WETH recorded:", ethers.utils.formatEther(wethRecorded));

    // 4. The deposit is NOT stored in DepositHandler (it's stateless)
    console.log("\n📍 4. DepositHandler:");
    console.log("  DepositHandler is stateless - doesn't store deposits");

    // Summary
    console.log("\n📝 Summary:");
    if (isInList && account === ethers.constants.AddressZero) {
        console.log("  ❌ Deposit exists in DEPOSIT_LIST but has corrupted data");
        console.log("  All deposit data is stored in DataStore");
        console.log("  Since account is 0x0, normal cancellation won't work");
    }

    // Check how many total deposits exist
    const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
    console.log("\n📊 Total deposits in queue:", depositCount.toString());
}

main().catch(console.error);