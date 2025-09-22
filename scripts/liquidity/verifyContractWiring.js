const { ethers } = require("hardhat");

async function main() {
    console.log("=== VERIFYING CONTRACT WIRING ===\n");

    const contracts = {
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_HANDLER: "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        ROUTER: "0x200882043647295a21F9202f9C1535BfB2A2f127",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        ROLE_STORE: "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778",
    };

    // 1. Check ExchangeRouter's DepositHandler
    console.log("1. ExchangeRouter Configuration:");
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", contracts.EXCHANGE_ROUTER);
    const depositHandlerInRouter = await exchangeRouter.depositHandler();
    console.log(`   DepositHandler in ExchangeRouter: ${depositHandlerInRouter}`);
    console.log(`   Expected: ${contracts.DEPOSIT_HANDLER}`);
    console.log(`   Match: ${depositHandlerInRouter.toLowerCase() === contracts.DEPOSIT_HANDLER.toLowerCase() ? "✅" : "❌"}`);

    // 2. Check DepositHandler's configuration
    console.log("\n2. DepositHandler Configuration:");
    const depositHandler = await ethers.getContractAt("DepositHandler", contracts.DEPOSIT_HANDLER);

    try {
        const dhDataStore = await depositHandler.dataStore();
        console.log(`   DataStore: ${dhDataStore}`);
        console.log(`   Match: ${dhDataStore.toLowerCase() === contracts.DATA_STORE.toLowerCase() ? "✅" : "❌"}`);
    } catch (e) {
        console.log(`   Could not read dataStore: ${e.message}`);
    }

    try {
        const dhDepositVault = await depositHandler.depositVault();
        console.log(`   DepositVault: ${dhDepositVault}`);
        console.log(`   Match: ${dhDepositVault.toLowerCase() === contracts.DEPOSIT_VAULT.toLowerCase() ? "✅" : "❌"}`);
    } catch (e) {
        console.log(`   Could not read depositVault: ${e.message}`);
    }

    // 3. Check Roles
    console.log("\n3. Role Configuration:");
    const roleStore = await ethers.getContractAt("RoleStore", contracts.ROLE_STORE);
    const CONTROLLER = ethers.utils.id("CONTROLLER");
    const ROUTER_PLUGIN = ethers.utils.id("ROUTER_PLUGIN");

    const exchangeRouterController = await roleStore.hasRole(contracts.EXCHANGE_ROUTER, CONTROLLER);
    const exchangeRouterPlugin = await roleStore.hasRole(contracts.EXCHANGE_ROUTER, ROUTER_PLUGIN);
    const depositHandlerController = await roleStore.hasRole(contracts.DEPOSIT_HANDLER, CONTROLLER);

    console.log(`   ExchangeRouter has CONTROLLER: ${exchangeRouterController ? "✅" : "❌"}`);
    console.log(`   ExchangeRouter has ROUTER_PLUGIN: ${exchangeRouterPlugin ? "✅" : "❌"}`);
    console.log(`   DepositHandler has CONTROLLER: ${depositHandlerController ? "✅" : "❌"}`);

    // 4. Check if contracts have code
    console.log("\n4. Contract Code Verification:");
    const provider = ethers.provider;
    for (const [name, address] of Object.entries(contracts)) {
        const code = await provider.getCode(address);
        const hasCode = code.length > 2;
        console.log(`   ${name}: ${hasCode ? "✅ Has code" : "❌ No code"} (${code.length} bytes)`);
    }

    // 5. Test a simple call path
    console.log("\n5. Testing Call Path:");
    console.log("   Simulating: ExchangeRouter -> DepositHandler communication");

    // Try to read depositHandler from ExchangeRouter and verify it's callable
    try {
        // This tests if the immutable is set correctly
        const dh = await exchangeRouter.depositHandler();
        console.log(`   ✅ Can read depositHandler from ExchangeRouter: ${dh}`);

        // Check if the address has code
        const dhCode = await provider.getCode(dh);
        if (dhCode.length > 2) {
            console.log(`   ✅ DepositHandler address has contract code`);
        } else {
            console.log(`   ❌ DepositHandler address has NO code!`);
        }
    } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
    }

    console.log("\n=== SUMMARY ===");
    if (exchangeRouterController && exchangeRouterPlugin && depositHandlerInRouter.toLowerCase() === contracts.DEPOSIT_HANDLER.toLowerCase()) {
        console.log("✅ Contract wiring appears correct");
        console.log("\nThe issue is likely in the execution logic, not the deployment.");
    } else {
        console.log("❌ Contract wiring issues found!");
        console.log("This explains why deposits aren't being created.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });