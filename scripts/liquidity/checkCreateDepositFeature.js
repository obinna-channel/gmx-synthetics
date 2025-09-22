const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING CREATE DEPOSIT FEATURE FLAGS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check if CREATE_DEPOSIT_FEATURE_DISABLED is set
    console.log("Checking feature flags...\n");

    const addresses = [
        { name: "DepositHandler", addr: DEPOSIT_HANDLER },
        { name: "ExchangeRouter", addr: EXCHANGE_ROUTER }
    ];

    for (const { name, addr } of addresses) {
        const featureKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "address"],
                [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CREATE_DEPOSIT_FEATURE_DISABLED")), addr]
            )
        );

        const isDisabled = await dataStore.getBool(featureKey);
        console.log(`${name} (${addr.slice(0, 10)}...)`);
        console.log(`  CREATE_DEPOSIT_FEATURE_DISABLED: ${isDisabled}`);

        if (isDisabled) {
            console.log("  ❌ Feature is DISABLED! This prevents deposits.");
        } else {
            console.log("  ✅ Feature is enabled");
        }
    }

    // Also check some global flags
    console.log("\n=== GLOBAL FLAGS ===");

    const globalFlags = [
        "IS_DEPOSIT_DISABLED",
        "SKIP_BORROWING_FEE_FOR_SMALLER_SIDE",
        "DEPOSITS_DISABLED"
    ];

    for (const flag of globalFlags) {
        const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(flag));
        try {
            const value = await dataStore.getBool(key);
            console.log(`${flag}: ${value}`);
        } catch (e) {
            // Skip
        }
    }

    // Check min/max values for the market
    console.log("\n=== MARKET CONFIGURATION ===");
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";

    const marketConfigs = [
        "MAX_PNL_FACTOR_FOR_DEPOSITS",
        "MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT",
        "MAX_POOL_AMOUNT",
        "MAX_OPEN_INTEREST"
    ];

    for (const config of marketConfigs) {
        const key = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["address", "bytes32"],
                [MARKET, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(config))]
            )
        );

        try {
            const value = await dataStore.getUint(key);
            console.log(`${config}: ${value.toString()}`);
        } catch (e) {
            // Skip
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });