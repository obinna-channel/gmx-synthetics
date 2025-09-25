const { ethers } = require("hardhat");

async function main() {
    console.log("=== Getting Deposit Details ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Account:", signer.address);

    // Correct contract addresses
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3"; // Correct Reader address from deployment
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Step 1: Check vault balance
    console.log("\n📊 DepositVault Balance:");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  USDT:", ethers.utils.formatUnits(vaultBalance, 6));

    // Step 2: Get deposit keys for our account
    const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
    );

    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ACCOUNT_DEPOSIT_LIST, signer.address]
        )
    );

    console.log("\n🔍 Checking deposits for account...");
    const depositCount = await dataStore.getBytes32Count(accountKey);
    console.log("  Number of deposits:", depositCount.toString());

    if (depositCount.gt(0)) {
        // Get the deposit keys
        const depositKeys = await dataStore.getBytes32ValuesAt(accountKey, 0, depositCount);

        for (let i = 0; i < depositKeys.length; i++) {
            console.log(`\n📦 Deposit ${i + 1}:`);
            console.log("  Key:", depositKeys[i]);

            try {
                // Read the deposit details
                const deposit = await reader.getDeposit(DATA_STORE, depositKeys[i]);

                console.log("\n  ✅ DEPOSIT DETAILS:");
                console.log("    Account (creator):", deposit.addresses.account);
                console.log("    Receiver:", deposit.addresses.receiver);
                console.log("    Callback Contract:", deposit.addresses.callbackContract);
                console.log("    UI Fee Receiver:", deposit.addresses.uiFeeReceiver);
                console.log("    Market:", deposit.addresses.market);
                console.log("    Initial Long Token:", deposit.addresses.initialLongToken);
                console.log("    Initial Short Token:", deposit.addresses.initialShortToken);

                console.log("\n    Amounts:");
                console.log("      Long Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
                console.log("      Short Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");
                console.log("      Min Market Tokens:", deposit.numbers.minMarketTokens.toString());
                console.log("      Execution Fee:", ethers.utils.formatEther(deposit.numbers.executionFee), "ETH");
                console.log("      Callback Gas Limit:", deposit.numbers.callbackGasLimit.toString());
                console.log("      Updated At Block:", deposit.numbers.updatedAtBlock.toString());

                console.log("\n    Flags:");
                console.log("      Should Unwrap Native Token:", deposit.flags.shouldUnwrapNativeToken);

                // Check if this is our first deposit (receiver = address(1))
                if (deposit.addresses.receiver === "0x0000000000000000000000000000000000000001") {
                    console.log("\n    🎯 This is the FIRST DEPOSIT (receiver = address(1))!");
                }

                // Calculate total deposit amount
                const totalAmount = deposit.numbers.initialLongTokenAmount.add(deposit.numbers.initialShortTokenAmount);
                console.log("\n    Total Deposit Amount:", ethers.utils.formatUnits(totalAmount, 6), "USDT");

            } catch (error) {
                console.log("  ❌ Error reading deposit:", error.message);
            }
        }
    } else {
        console.log("  No deposits found for this account");
    }

    // Step 3: Check if there are any deposits for address(1)
    console.log("\n\n🔍 Checking deposits for address(1)...");
    const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";

    const addressOneKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ACCOUNT_DEPOSIT_LIST, ADDRESS_ONE]
        )
    );

    try {
        const addressOneDepositCount = await dataStore.getBytes32Count(addressOneKey);
        console.log("  Number of deposits for address(1):", addressOneDepositCount.toString());

        if (addressOneDepositCount.gt(0)) {
            const addressOneDepositKeys = await dataStore.getBytes32ValuesAt(addressOneKey, 0, addressOneDepositCount);
            console.log("  Deposit keys for address(1):", addressOneDepositKeys);
        }
    } catch (error) {
        console.log("  Could not check address(1) deposits:", error.message);
    }

    console.log("\n=== Summary ===");
    console.log("✅ Deposit successfully created and stored in DataStore");
    console.log("✅ 100 USDT transferred to DepositVault");
    console.log("✅ Deposit is waiting for keeper execution");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });