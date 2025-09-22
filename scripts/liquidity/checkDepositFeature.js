const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING DEPOSIT FEATURE STATUS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check if CREATE_DEPOSIT_FEATURE is disabled for DepositHandler
    console.log("Checking if deposit creation is disabled for DepositHandler...");
    const depositHandlerFeatureKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CREATE_DEPOSIT_FEATURE_DISABLED")), DEPOSIT_HANDLER]
        )
    );

    const depositHandlerDisabled = await dataStore.getBool(depositHandlerFeatureKey);
    console.log("DepositHandler deposit creation disabled:", depositHandlerDisabled);

    if (depositHandlerDisabled) {
        console.log("❌ DEPOSIT CREATION IS DISABLED FOR DEPOSITHANDLER!");
        console.log("This is why deposits aren't being created!");
    } else {
        console.log("✅ Deposit creation is enabled for DepositHandler");
    }

    // Also check for ExchangeRouter (though it's not the one that checks this)
    console.log("\nChecking if deposit creation is disabled for ExchangeRouter...");
    const exchangeRouterFeatureKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CREATE_DEPOSIT_FEATURE_DISABLED")), EXCHANGE_ROUTER]
        )
    );

    const exchangeRouterDisabled = await dataStore.getBool(exchangeRouterFeatureKey);
    console.log("ExchangeRouter deposit creation disabled:", exchangeRouterDisabled);

    if (exchangeRouterDisabled) {
        console.log("⚠️ Deposit creation is disabled for ExchangeRouter");
        console.log("(This might not affect anything since ExchangeRouter doesn't check this)");
    } else {
        console.log("✅ Deposit creation is enabled for ExchangeRouter");
    }

    console.log("\n=== SOLUTION ===");
    if (depositHandlerDisabled) {
        console.log("To fix this, we need to enable deposit creation:");
        console.log("dataStore.setBool(depositHandlerFeatureKey, false)");
    } else {
        console.log("The feature is not disabled, so the issue is elsewhere.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });