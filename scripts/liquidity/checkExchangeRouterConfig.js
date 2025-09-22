const { ethers } = require("hardhat");

async function main() {
    console.log("=== CHECKING EXCHANGE ROUTER CONFIGURATION ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("ExchangeRouter:", EXCHANGE_ROUTER);
    console.log("Expected DepositHandler:", DEPOSIT_HANDLER);

    // Check if DepositHandler is set in ExchangeRouter
    try {
        const depositHandler = await exchangeRouter.depositHandler();
        console.log("\n✅ DepositHandler in ExchangeRouter:", depositHandler);

        if (depositHandler.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
            console.log("✅ DepositHandler matches expected address");
        } else {
            console.log("❌ DepositHandler MISMATCH!");
            console.log("This is the problem - ExchangeRouter is using wrong DepositHandler");
        }
    } catch (error) {
        console.log("Could not read depositHandler from ExchangeRouter");
        console.log("Error:", error.message);
    }

    // Check if deposit creation is enabled
    console.log("\n=== CHECKING IF DEPOSITS ARE ENABLED ===");

    const createDepositFeatureKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(
            ["bytes32", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CREATE_DEPOSIT_FEATURE_DISABLED")), EXCHANGE_ROUTER]
        )
    );

    const isDisabled = await dataStore.getBool(createDepositFeatureKey);
    if (isDisabled) {
        console.log("❌ CREATE_DEPOSIT_FEATURE is DISABLED!");
        console.log("This would prevent deposits from being created");
    } else {
        console.log("✅ Deposit creation is enabled");
    }

    // Check router plugin role
    console.log("\n=== CHECKING ROUTER PLUGIN ROLE ===");

    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    const ROUTER_PLUGIN = ethers.utils.id("ROUTER_PLUGIN");
    const hasPluginRole = await roleStore.hasRole(EXCHANGE_ROUTER, ROUTER_PLUGIN);

    if (hasPluginRole) {
        console.log("✅ ExchangeRouter has ROUTER_PLUGIN role");
    } else {
        console.log("❌ ExchangeRouter does NOT have ROUTER_PLUGIN role");
        console.log("This might prevent it from interacting with vaults");
    }

    // Try to simulate createDeposit to see what happens
    console.log("\n=== SIMULATING DIRECT CALL ===");

    const depositParams = {
        addresses: {
            receiver: "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292",
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
            initialLongToken: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
            initialShortToken: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    try {
        console.log("Simulating createDeposit...");
        const result = await exchangeRouter.callStatic.createDeposit(
            depositParams,
            { value: 0 }
        );
        console.log("Simulation result:", result);
    } catch (error) {
        console.log("Simulation failed:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }

    console.log("\n=== DIAGNOSIS ===");
    console.log("The ExchangeRouter is accepting the createDeposit call");
    console.log("But it's not actually creating a deposit in DepositHandler");
    console.log("Check the issues identified above to fix the problem");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });