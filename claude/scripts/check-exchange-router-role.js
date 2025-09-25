const { ethers } = require("hardhat");

async function main() {
    const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";

    console.log("=== Checking ExchangeRouter Roles ===\n");

    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    // Calculate CONTROLLER role hash
    const CONTROLLER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );

    console.log("CONTROLLER role hash:", CONTROLLER);

    // Check if ExchangeRouter has CONTROLLER role
    const hasControllerRole = await roleStore.hasRole(EXCHANGE_ROUTER, CONTROLLER);
    console.log("\nExchangeRouter has CONTROLLER role:", hasControllerRole);

    // Also check if ExchangeRouter has CONTROLLER role specifically on DepositHandler
    const hasControllerOnDepositHandler = await roleStore.hasRole(EXCHANGE_ROUTER, CONTROLLER);
    console.log("ExchangeRouter has CONTROLLER on DepositHandler:", hasControllerOnDepositHandler);

    // Check who is the role admin (if available)
    const ROLE_ADMIN = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ROLE_ADMIN"])
    );
    console.log("\nExpected ROLE_ADMIN hash:", ROLE_ADMIN);

    // Check if our signer has CONTROLLER role
    const [signer] = await ethers.getSigners();
    const signerHasController = await roleStore.hasRole(signer.address, CONTROLLER);
    console.log("\nSigner has CONTROLLER role:", signerHasController);

    // Get all members with CONTROLLER role
    const controllerCount = await roleStore.getRoleMemberCount(CONTROLLER);
    console.log("\nTotal addresses with CONTROLLER role:", controllerCount.toString());

    if (controllerCount.gt(0)) {
        console.log("CONTROLLER role members:");
        for (let i = 0; i < controllerCount.toNumber(); i++) {
            const member = await roleStore.getRoleMember(CONTROLLER, i);
            console.log(`  ${i + 1}. ${member}`);

            // Check if it's a contract
            const code = await ethers.provider.getCode(member);
            if (code !== "0x") {
                console.log("     (Contract)");

                // Try to identify the contract
                if (member === EXCHANGE_ROUTER) {
                    console.log("     -> This is ExchangeRouter");
                } else if (member === DEPOSIT_HANDLER) {
                    console.log("     -> This is DepositHandler");
                }
            } else {
                console.log("     (EOA)");
            }
        }
    }

    // Also check the depositHandler address in ExchangeRouter
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const depositHandlerAddress = await exchangeRouter.depositHandler();
    console.log("\nExchangeRouter's depositHandler:", depositHandlerAddress);
    console.log("Expected DepositHandler:", DEPOSIT_HANDLER);
    console.log("Match:", depositHandlerAddress === DEPOSIT_HANDLER);
}

main().catch(console.error);