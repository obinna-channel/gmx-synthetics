const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING EXCHANGE ROUTER CONFIGURATION ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const EXPECTED_DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    console.log("ExchangeRouter address:", EXCHANGE_ROUTER);
    console.log("Expected DepositHandler:", EXPECTED_DEPOSIT_HANDLER);

    // Check if depositHandler is set
    console.log("\n=== CHECKING DEPOSIT HANDLER ===");
    try {
        const depositHandler = await exchangeRouter.depositHandler();
        console.log("DepositHandler in ExchangeRouter:", depositHandler);

        if (depositHandler.toLowerCase() === EXPECTED_DEPOSIT_HANDLER.toLowerCase()) {
            console.log("✅ DepositHandler address matches!");
        } else {
            console.log("❌ DepositHandler MISMATCH!");
            console.log("This is likely the problem!");
        }
    } catch (error) {
        console.log("❌ Could not read depositHandler:", error.message);
    }

    // Check roles
    console.log("\n=== CHECKING ROLES ===");
    const CONTROLLER = ethers.utils.id("CONTROLLER");
    const ROUTER_PLUGIN = ethers.utils.id("ROUTER_PLUGIN");

    const hasController = await roleStore.hasRole(EXCHANGE_ROUTER, CONTROLLER);
    const hasRouterPlugin = await roleStore.hasRole(EXCHANGE_ROUTER, ROUTER_PLUGIN);

    console.log("ExchangeRouter has CONTROLLER role:", hasController);
    console.log("ExchangeRouter has ROUTER_PLUGIN role:", hasRouterPlugin);

    if (!hasController || !hasRouterPlugin) {
        console.log("\n❌ Missing required roles!");
        console.log("This could prevent proper operation.");
    }

    // Check if DepositHandler has CONTROLLER role (needed to receive calls)
    console.log("\n=== CHECKING DEPOSIT HANDLER ROLES ===");
    const depositHandlerController = await roleStore.hasRole(EXPECTED_DEPOSIT_HANDLER, CONTROLLER);
    console.log("DepositHandler has CONTROLLER role:", depositHandlerController);

    // Try a direct call to see what happens
    console.log("\n=== TESTING DIRECT CALL ===");
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",
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
        console.log("Simulating createDeposit call...");
        const result = await exchangeRouter.callStatic.createDeposit(depositParams, { value: 0 });
        console.log("✅ Simulation returned:", result);
    } catch (error) {
        console.log("❌ Simulation failed:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });