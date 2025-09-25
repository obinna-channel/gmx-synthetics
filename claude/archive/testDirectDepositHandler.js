const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING DEPOSIT HANDLER DIRECTLY ===\n");

    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const ROLE_STORE = "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const [signer] = await ethers.getSigners();
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // First, grant ourselves CONTROLLER role if we don't have it
    const CONTROLLER = ethers.utils.id("CONTROLLER");
    const hasController = await roleStore.hasRole(signer.address, CONTROLLER);

    if (!hasController) {
        console.log("Granting CONTROLLER role to signer...");
        const tx = await roleStore.grantRole(signer.address, CONTROLLER);
        await tx.wait();
        console.log("✅ CONTROLLER role granted\n");
    }

    // Send USDT to DepositVault
    console.log("Sending 50 USDT to DepositVault...");
    const amount = ethers.utils.parseUnits("50", 6);
    const transferTx = await usdt.transfer(DEPOSIT_VAULT, amount);
    await transferTx.wait();
    console.log("✅ Sent 50 USDT\n");

    // Sync the token balance in DepositVault (this updates tokenBalances mapping)
    console.log("Syncing DepositVault token balance...");
    const depositVault = await ethers.getContractAt("StrictBank", DEPOSIT_VAULT);
    try {
        const syncTx = await depositVault.syncTokenBalance(USDT);
        await syncTx.wait();
        console.log("✅ Token balance synced\n");
    } catch (e) {
        console.log("Could not sync (may require CONTROLLER):", e.message, "\n");
    }

    // Create deposit parameters
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",
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

    console.log("=== CALLING DEPOSIT HANDLER DIRECTLY ===");

    try {
        const tx = await depositHandler.createDeposit(
            signer.address,
            0, // srcChainId
            depositParams,
            { gasLimit: 2000000 }
        );

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();

        console.log("\n✅ SUCCESS! Transaction confirmed");
        console.log("Block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Check for deposit key in logs
        console.log("\n=== CHECKING LOGS ===");
        for (const log of receipt.logs) {
            console.log(`Log from ${log.address.slice(0, 10)}...`);
            if (log.address.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
                console.log("  ✅ LOG FROM DEPOSIT HANDLER!");
                if (log.topics[1]) {
                    const depositKey = log.topics[1];
                    console.log("  Deposit key:", depositKey);

                    // Verify in DataStore
                    const accountKey = ethers.utils.keccak256(
                        ethers.utils.solidityPack(
                            ["bytes32", "bytes32"],
                            [depositKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
                        )
                    );
                    const account = await dataStore.getAddress(accountKey);
                    if (account !== ethers.constants.AddressZero) {
                        console.log("\n🎉 DEPOSIT CONFIRMED IN DATASTORE!");
                        console.log("Account:", account);
                    }
                }
            }
        }

    } catch (error) {
        console.log("\n❌ FAILED:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);

            // Try to decode the error
            const errors = {
                "0x01af8c24": "Likely recordTransferIn returned 0 (no tokens detected)",
                "0x8e4a23d6": "Unauthorized (no CONTROLLER role)",
            };

            if (errors[error.data]) {
                console.log("Error meaning:", errors[error.data]);
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });