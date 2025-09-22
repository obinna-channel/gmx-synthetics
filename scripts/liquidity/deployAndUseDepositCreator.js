const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEPLOYING DEPOSIT CREATOR WORKAROUND ===\n");

    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const ROUTER = "0x200882043647295a21F9202f9C1535BfB2A2f127";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";

    const [signer] = await ethers.getSigners();

    // Deploy DepositCreator
    console.log("Deploying DepositCreator contract...");
    const DepositCreator = await ethers.getContractFactory("DepositCreator");
    const depositCreator = await DepositCreator.deploy(DEPOSIT_HANDLER);
    await depositCreator.deployed();
    console.log("✅ DepositCreator deployed at:", depositCreator.address);

    // Grant CONTROLLER role to DepositCreator
    console.log("\nGranting CONTROLLER role to DepositCreator...");
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    const CONTROLLER = ethers.utils.id("CONTROLLER");
    const grantTx = await roleStore.grantRole(depositCreator.address, CONTROLLER);
    await grantTx.wait();
    console.log("✅ CONTROLLER role granted");

    // Prepare for deposit
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const amount = ethers.utils.parseUnits("50", 6);

    // Step 1: Approve Router
    console.log("\n1. Approving Router to spend USDT...");
    const approveTx = await usdt.approve(ROUTER, amount);
    await approveTx.wait();
    console.log("✅ Approved");

    // Step 2: Send tokens to DepositVault using Router
    console.log("\n2. Sending USDT to DepositVault via Router...");
    const router = await ethers.getContractAt("Router", ROUTER);

    // Grant ROUTER_PLUGIN role to our signer temporarily
    const ROUTER_PLUGIN = ethers.utils.id("ROUTER_PLUGIN");
    const pluginTx = await roleStore.grantRole(signer.address, ROUTER_PLUGIN);
    await pluginTx.wait();
    console.log("✅ ROUTER_PLUGIN role granted to signer");

    const transferTx = await router.pluginTransfer(USDT, signer.address, DEPOSIT_VAULT, amount);
    await transferTx.wait();
    console.log("✅ Transferred 50 USDT to DepositVault");

    // Step 3: Create deposit using our DepositCreator
    console.log("\n3. Creating deposit via DepositCreator...");
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT,
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
        const createTx = await depositCreator.createDeposit(depositParams, { gasLimit: 2000000 });
        console.log("Transaction sent:", createTx.hash);

        const receipt = await createTx.wait();
        console.log("\n✅ Transaction confirmed!");
        console.log("Block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Check for deposit key in logs
        console.log("\n=== CHECKING FOR DEPOSIT KEY ===");
        let depositKey = null;

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
                console.log("✅ Found log from DepositHandler!");
                if (log.topics[1]) {
                    depositKey = log.topics[1];
                    console.log("Deposit key:", depositKey);
                    break;
                }
            }
        }

        if (depositKey) {
            // Verify in DataStore
            const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
            const accountKey = ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ["bytes32", "bytes32"],
                    [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
                )
            );
            const account = await dataStore.getAddress(accountKey);
            if (account !== ethers.constants.AddressZero) {
                console.log("\n🎉 DEPOSIT SUCCESSFULLY CREATED!");
                console.log("Account:", account);
                console.log("\nDeposit key for execution:");
                console.log(depositKey);

                // Save key
                const fs = require('fs');
                fs.writeFileSync('deposit-key.txt', depositKey);
                console.log("Key saved to deposit-key.txt");
            }
        }

    } catch (error) {
        console.log("\n❌ Failed:", error.message);
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