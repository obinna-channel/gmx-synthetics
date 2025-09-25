const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Verifying Deposit Details ===\n");

    // Contract addresses from deployment (using checksummed addresses)
    const DATA_STORE = "0xaD068899b3a9A0Cf0587d35C7b13d4E949F1ce5E";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const READER = "0xED0Ad83195A59E45B27900ebEfa988BfCdDca12f";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";

    // Get contracts
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const depositVault = await ethers.getContractAt("DepositVault", DEPOSIT_VAULT);
    const reader = await ethers.getContractAt("Reader", READER);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Step 1: Check DepositVault balance
    console.log("Step 1: Checking DepositVault USDT balance...");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("  Balance in wei:", vaultBalance.toString(), "\n");

    // Step 2: Check deposit count
    console.log("Step 2: Checking deposit count in DataStore...");

    // Hash for DEPOSIT_LIST key
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );

    try {
        const depositCount = await dataStore.getAddressCount(DEPOSIT_LIST);
        console.log("  Total deposits in system:", depositCount.toString());

        if (depositCount.gt(0)) {
            console.log("\n  Fetching deposit keys...");
            const depositKeys = await dataStore.getAddressValuesAt(DEPOSIT_LIST, 0, depositCount);
            console.log("  Deposit keys found:", depositKeys.length);

            for (let i = 0; i < depositKeys.length; i++) {
                console.log(`\n  Deposit ${i + 1} Key:`, depositKeys[i]);

                // Try to get deposit details using Reader
                try {
                    const deposit = await reader.getDeposit(dataStore.address, depositKeys[i]);
                    console.log("    Account:", deposit.addresses.account);
                    console.log("    Receiver:", deposit.addresses.receiver);
                    console.log("    Market:", deposit.addresses.market);
                    console.log("    Initial Long Token:", deposit.addresses.initialLongToken);
                    console.log("    Initial Short Token:", deposit.addresses.initialShortToken);
                    console.log("    Long Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
                    console.log("    Short Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");
                    console.log("    Min Market Tokens:", deposit.numbers.minMarketTokens.toString());
                    console.log("    Execution Fee:", ethers.utils.formatEther(deposit.numbers.executionFee), "ETH");
                    console.log("    Updated At Block:", deposit.numbers.updatedAtBlock.toString());
                } catch (error) {
                    console.log("    Error reading deposit details:", error.message);
                }
            }
        } else {
            console.log("  No deposits found in the system");
        }
    } catch (error) {
        console.log("  Error checking deposit count:", error.message);
    }

    // Step 3: Check account deposits
    console.log("\n\nStep 3: Checking deposits for our account...");

    // Hash for ACCOUNT_DEPOSIT_LIST key
    const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
    );

    try {
        // Create the key for our account's deposits
        const accountDepositKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ACCOUNT_DEPOSIT_LIST, signer.address]
            )
        );

        const accountDepositCount = await dataStore.getBytes32Count(accountDepositKey);
        console.log("  Deposits for", signer.address + ":", accountDepositCount.toString());

        if (accountDepositCount.gt(0)) {
            const accountDepositKeys = await dataStore.getBytes32ValuesAt(accountDepositKey, 0, accountDepositCount);
            console.log("  Deposit keys for account:", accountDepositKeys);
        }
    } catch (error) {
        console.log("  Error checking account deposits:", error.message);
    }

    // Step 4: Check for receiver = address(1) deposits
    console.log("\n\nStep 4: Checking for deposits with receiver = address(1)...");

    const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";
    const accountDepositKeyForAddressOne = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [ACCOUNT_DEPOSIT_LIST, ADDRESS_ONE]
        )
    );

    try {
        const addressOneDepositCount = await dataStore.getBytes32Count(accountDepositKeyForAddressOne);
        console.log("  Deposits for address(1):", addressOneDepositCount.toString());

        if (addressOneDepositCount.gt(0)) {
            const addressOneDepositKeys = await dataStore.getBytes32ValuesAt(accountDepositKeyForAddressOne, 0, addressOneDepositCount);
            console.log("  Found", addressOneDepositKeys.length, "deposit(s) for address(1)");

            for (let i = 0; i < addressOneDepositKeys.length; i++) {
                console.log(`\n  Reading deposit ${i + 1} details...`);
                try {
                    const deposit = await reader.getDeposit(dataStore.address, addressOneDepositKeys[i]);
                    console.log("    Deposit Key:", addressOneDepositKeys[i]);
                    console.log("    Account (creator):", deposit.addresses.account);
                    console.log("    Receiver:", deposit.addresses.receiver);
                    console.log("    Market:", deposit.addresses.market);
                    console.log("    Long Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
                    console.log("    Short Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");
                    console.log("    Execution Fee:", ethers.utils.formatEther(deposit.numbers.executionFee), "ETH");
                    console.log("    Created at Block:", deposit.numbers.updatedAtBlock.toString());
                } catch (error) {
                    console.log("    Error reading deposit:", error.message);
                }
            }
        }
    } catch (error) {
        console.log("  Error checking address(1) deposits:", error.message);
    }

    // Step 5: Check market pool amount
    console.log("\n\nStep 5: Checking market pool amount...");

    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );

    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, USDT]
        )
    );

    try {
        const poolAmount = await dataStore.getUint(poolAmountKey);
        console.log("  Pool amount for USDT in market:", ethers.utils.formatUnits(poolAmount, 6), "USDT");
        console.log("  Pool amount in wei:", poolAmount.toString());
    } catch (error) {
        console.log("  Error checking pool amount:", error.message);
    }

    console.log("\n=== Verification Complete ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });