const { ethers } = require("hardhat");

async function main() {
    console.log("=== SIMPLE DEPOSIT CREATION ===\n");

    const DEPOSIT_CREATOR = "0xFBc102af98FE03fa78C72407b50574CF4D6Bc97f"; // Just deployed
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const [signer] = await ethers.getSigners();
    const depositCreator = await ethers.getContractAt("DepositCreator", DEPOSIT_CREATOR);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Just send USDT directly to DepositVault
    console.log("Sending 50 USDT directly to DepositVault...");
    const amount = ethers.utils.parseUnits("50", 6);
    const transferTx = await usdt.transfer(DEPOSIT_VAULT, amount);
    await transferTx.wait();
    console.log("✅ Sent 50 USDT");

    // Sync the vault balance
    const depositVault = await ethers.getContractAt("StrictBank", DEPOSIT_VAULT);
    try {
        console.log("\nSyncing vault balance...");
        const syncTx = await depositVault.syncTokenBalance(USDT);
        await syncTx.wait();
        console.log("✅ Synced");
    } catch (e) {
        console.log("Could not sync (may need CONTROLLER role)");
    }

    // Create deposit
    console.log("\nCreating deposit...");
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1)
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
        const tx = await depositCreator.createDeposit(depositParams, { gasLimit: 2000000 });
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("\n✅ Transaction confirmed!");
        console.log("Block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Look for deposit key
        console.log("\n=== CHECKING LOGS ===");
        let depositKey = null;

        for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            console.log(`Log ${i}: ${log.address.slice(0, 10)}...`);

            if (log.topics.length > 1 && log.topics[1].length === 66) {
                const potentialKey = log.topics[1];
                console.log(`  Checking: ${potentialKey.slice(0, 10)}...`);

                // Check if it's a real deposit
                const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
                const accountKey = ethers.utils.keccak256(
                    ethers.utils.solidityPack(
                        ["bytes32", "bytes32"],
                        [potentialKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ACCOUNT"))]
                    )
                );

                const account = await dataStore.getAddress(accountKey);
                if (account !== ethers.constants.AddressZero) {
                    depositKey = potentialKey;
                    console.log(`  ✅ VALID DEPOSIT KEY!`);
                    console.log(`  Account: ${account}`);
                    break;
                }
            }
        }

        if (depositKey) {
            console.log("\n🎉 DEPOSIT CREATED SUCCESSFULLY!");
            console.log("Deposit key:", depositKey);

            const fs = require('fs');
            fs.writeFileSync('deposit-key.txt', depositKey);
            console.log("Saved to deposit-key.txt");
        } else {
            console.log("\n❌ No valid deposit key found");
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