const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING PENDING DEPOSITS AND VAULT STATUS ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970"
    };

    const [signer] = await ethers.getSigners();
    const depositVault = await ethers.getContractAt("DepositVault", ADDRESSES.DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    console.log("=== VAULT BALANCES ===");

    // Check actual USDT balance in vault
    const actualBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("Actual USDT in vault:", ethers.utils.formatUnits(actualBalance, 6), "USDT");

    // Try to check recorded transfer amounts in the vault
    console.log("\n=== CHECKING RECORDED AMOUNTS ===");

    // The vault tracks recorded amounts per user/token
    try {
        // Try to get recorded transfer amount for our signer
        const recordedAmountKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "address"],
                [signer.address, ADDRESSES.USDT]
            )
        );

        // This might not work directly, but let's try
        console.log("Checking for recorded amounts for signer:", signer.address);

        // The DepositVault uses tokenBalances mapping
        // Let's try to read it through the DataStore
        const vaultTokenKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "address"],
                [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEPOSIT_VAULT_TOKEN_BALANCE")), ADDRESSES.USDT]
            )
        );

        const recordedAmount = await dataStore.getUint(vaultTokenKey);
        if (recordedAmount.gt(0)) {
            console.log("Recorded USDT amount in vault system:", ethers.utils.formatUnits(recordedAmount, 6));
        }
    } catch (error) {
        console.log("Could not read recorded amounts directly");
    }

    console.log("\n=== CHECKING FOR PENDING DEPOSITS ===");

    // Check if there are any deposit keys we know about
    const knownDepositKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";

    console.log("Checking known deposit key:", knownDepositKey);

    // Check if this deposit still exists
    const accountKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "bytes32"],
            [knownDepositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
        )
    );

    const depositAccount = await dataStore.getAddress(accountKey);
    if (depositAccount !== ethers.constants.AddressZero) {
        console.log("❌ DEPOSIT STILL EXISTS for account:", depositAccount);

        // Get more details about this deposit
        const amountKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "bytes32"],
                [knownDepositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INITIAL_LONG_TOKEN_AMOUNT"))]
            )
        );
        const amount = await dataStore.getUint(amountKey);
        console.log("Deposit amount:", ethers.utils.formatUnits(amount, 6), "USDT");

        console.log("\n⚠️ This pending deposit is likely using the USDT in the vault!");
        console.log("You need to either:");
        console.log("1. Execute this existing deposit, OR");
        console.log("2. Cancel this deposit to free up the USDT");
    } else {
        console.log("✅ No deposit found with this key (was executed or cancelled)");
    }

    console.log("\n=== SOLUTION ===");

    if (actualBalance.gt(0)) {
        console.log("There is", ethers.utils.formatUnits(actualBalance, 6), "USDT in the vault");

        if (depositAccount !== ethers.constants.AddressZero) {
            console.log("\n❌ BUT it's locked in a pending deposit!");
            console.log("The deposit creation is failing because these tokens are already allocated.");
            console.log("\nTo create a new deposit, you need FRESH USDT:");
            console.log("1. Transfer NEW USDT to the vault (not use existing)");
            console.log("2. Then create the deposit");
        } else {
            console.log("\n🤔 The USDT might be from old cancelled deposits");
            console.log("But the system might still have it marked as 'used'");
            console.log("Try transferring FRESH USDT for a new deposit");
        }
    }

    console.log("\n=== RECOMMENDED APPROACH ===");
    console.log("1. Transfer FRESH 100 USDT to DepositVault");
    console.log("2. Create deposit with those fresh funds");
    console.log("3. This should work as it won't conflict with existing deposits");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });