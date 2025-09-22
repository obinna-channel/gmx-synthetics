const { ethers } = require("hardhat");

async function main() {
    console.log("=== Debugging Latest Failure ===\n");

    const txHash = "0x945c396873e8b31aa67b1818b8dc665d22c9bd844dc53986283facc335bc77af";

    const provider = ethers.provider;
    const depositHandler = await ethers.getContractAt("DepositHandler", "0xEfA03387703cc220e6273fB25Fa847d474984057");

    // Try to simulate the call
    const DEPOSIT_KEY = "0x3772b0c5ec95382c48668749a697d7586df957e3d46b97658950d33d9daa5910";
    const emptyOracleParams = {
        tokens: [],
        providers: [],
        data: []
    };

    console.log("Attempting to reproduce error via static call...");

    try {
        await depositHandler.callStatic.executeDeposit(
            DEPOSIT_KEY,
            emptyOracleParams,
            { from: "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292" }
        );
    } catch (error) {
        console.log("\n❌ Error reproduced!");
        console.log("Message:", error.message);

        if (error.data) {
            console.log("Error data:", error.data);

            // Try to decode common errors
            const errorSelectors = {
                "0x7c1f8113": "EmptyDeposit",
                "0x2e30c16f": "OracleTimestampsAreLargerThanRequestExpirationTime",
                "0x8ac2c168": "OracleTimestampsAreSmallerThanRequired",
                "0x89b2b761": "DisabledFeature",
                "0xb97e9d4a": "EmptyPrimaryPrice"
            };

            const selector = error.data.substring(0, 10);
            if (errorSelectors[selector]) {
                console.log("\n❗ Error type:", errorSelectors[selector]);
            } else {
                console.log("\n❓ Unknown error selector:", selector);
            }
        }
    }

    // Check if deposit still exists
    console.log("\n\nChecking if deposit still exists...");

    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    try {
        const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
        console.log("✅ Deposit still exists!");
        console.log("  Account:", deposit.addresses.account);
        console.log("  Updated at block:", deposit.numbers.updatedAtBlock.toString());

        // Check deposit creation time
        const depositBlock = await provider.getBlock(deposit.numbers.updatedAtBlock);
        const depositTimestamp = depositBlock.timestamp;
        const currentTime = Math.floor(Date.now() / 1000);
        const age = currentTime - depositTimestamp;

        console.log("  Deposit timestamp:", depositTimestamp);
        console.log("  Current timestamp:", currentTime);
        console.log("  Deposit age:", age, "seconds");

        // Check REQUEST_EXPIRATION_TIME
        const REQUEST_EXPIRATION_TIME_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["REQUEST_EXPIRATION_TIME"])
        );
        const expirationTime = await dataStore.getUint(REQUEST_EXPIRATION_TIME_KEY);
        console.log("  REQUEST_EXPIRATION_TIME:", expirationTime.toString(), "seconds");

        if (age > expirationTime.toNumber()) {
            console.log("  ⚠️  DEPOSIT HAS EXPIRED!");
        } else {
            console.log("  ✅ Deposit is still valid");
        }

    } catch (error) {
        console.log("❌ Could not read deposit - it might have been executed or removed");
        console.log("Error:", error.message);
    }

    // Check oracle timestamps
    console.log("\n\nChecking Oracle Timestamps...");
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    const minTs = await oracle.minTimestamp();
    const maxTs = await oracle.maxTimestamp();
    console.log("  Oracle min timestamp:", minTs.toString());
    console.log("  Oracle max timestamp:", maxTs.toString());

    // Check feature flags
    console.log("\n\nChecking Feature Flags...");
    const EXECUTE_DEPOSIT_FEATURE_DISABLED_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["EXECUTE_DEPOSIT_FEATURE_DISABLED"])
    );

    const featureKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [EXECUTE_DEPOSIT_FEATURE_DISABLED_KEY, depositHandler.address]
        )
    );

    const isDisabled = await dataStore.getBool(featureKey);
    console.log("  Execute deposit feature disabled:", isDisabled);
}

main().catch(console.error);