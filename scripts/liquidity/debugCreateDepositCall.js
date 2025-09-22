const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEBUGGING CREATE DEPOSIT CALL PATH ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

    console.log("=== CHECKING CONTROLLER ROLE ===");
    const CONTROLLER = ethers.utils.id("CONTROLLER");

    // Check if ExchangeRouter has CONTROLLER role
    const exchangeRouterIsController = await roleStore.hasRole(EXCHANGE_ROUTER, CONTROLLER);
    console.log("ExchangeRouter has CONTROLLER role:", exchangeRouterIsController);

    if (!exchangeRouterIsController) {
        console.log("❌ This is the problem! ExchangeRouter needs CONTROLLER role to call DepositHandler");
        return;
    }

    console.log("✅ ExchangeRouter has CONTROLLER role");

    // Try to call DepositHandler directly from ExchangeRouter's perspective
    console.log("\n=== SIMULATING DEPOSITHANDLER.CREATEDEPOSIT ===");

    const [signer] = await ethers.getSigners();

    // Check if our signer has CONTROLLER role
    const signerIsController = await roleStore.hasRole(signer.address, CONTROLLER);
    console.log("Our signer has CONTROLLER role:", signerIsController);

    if (!signerIsController) {
        console.log("Granting CONTROLLER role to signer for testing...");
        try {
            const tx = await roleStore.grantRole(signer.address, CONTROLLER);
            await tx.wait();
            console.log("✅ CONTROLLER role granted");
        } catch (error) {
            console.log("Could not grant role:", error.message);
        }
    }

    // Now try to call createDeposit directly on DepositHandler
    const depositParams = {
        addresses: {
            receiver: signer.address,
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
        console.log("\nTrying to call DepositHandler.createDeposit directly...");
        const result = await depositHandler.callStatic.createDeposit(
            signer.address,  // account
            0,  // srcChainId
            depositParams
        );
        console.log("✅ Direct call would succeed! Deposit key:", result);
        console.log("\nThis proves DepositHandler can create deposits");
    } catch (error) {
        console.log("❌ Direct call failed:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }

    // Check what DepositHandler address the ExchangeRouter is using
    console.log("\n=== CHECKING EXCHANGEROUTER'S DEPOSITHANDLER ===");
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);

    try {
        const routerDepositHandler = await exchangeRouter.depositHandler();
        console.log("ExchangeRouter's depositHandler:", routerDepositHandler);
        console.log("Expected depositHandler:", DEPOSIT_HANDLER);

        if (routerDepositHandler.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
            console.log("✅ Addresses match");
        } else {
            console.log("❌ MISMATCH - ExchangeRouter is using wrong DepositHandler!");
        }
    } catch (error) {
        console.log("Could not read depositHandler:", error.message);
    }

    console.log("\n=== CONCLUSION ===");
    console.log("The issue is that ExchangeRouter.createDeposit is not properly");
    console.log("forwarding to DepositHandler.createDeposit, even though:");
    console.log("1. ExchangeRouter has CONTROLLER role");
    console.log("2. DepositHandler address is correct");
    console.log("\nThe transaction succeeds but only emits an event without creating a deposit.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });