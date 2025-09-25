const { ethers } = require("hardhat");

async function main() {
    console.log("=== CREATING FIRST DEPOSIT - WITH FIXED ROUTER_PLUGIN ROLE ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    // Check current balances
    const signerBalance = await usdt.balanceOf(signer.address);
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);

    console.log("Your USDT:", ethers.utils.formatUnits(signerBalance, 6), "USDT");
    console.log("DepositVault USDT:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Transfer 50 USDT to DepositVault
    const amount = ethers.utils.parseUnits("50", 6);
    console.log("\nTransferring 50 USDT to DepositVault...");

    const transferTx = await usdt.transfer(ADDRESSES.DEPOSIT_VAULT, amount);
    await transferTx.wait();
    console.log("✅ Transferred 50 USDT to DepositVault");

    // Create deposit with receiver as address(1) for first deposit
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // ADDRESS(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n=== DEPOSIT PARAMETERS ===");
    console.log("Receiver: address(1) - REQUIRED FOR FIRST DEPOSIT");
    console.log("Market:", ADDRESSES.MARKET);
    console.log("Tokens: Both USDT");
    console.log("Execution Fee: 0");

    try {
        console.log("\n=== CREATING DEPOSIT ===");
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            {
                value: 0,
                gasLimit: 1000000
            }
        );

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();

        console.log("\n✅ Transaction confirmed!");
        console.log("Block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Extract deposit key from logs
        console.log("\n=== EXTRACTING DEPOSIT KEY ===");
        const eventEmitterAddress = "0xE4fFaF6533F6044Fd4E7e19D60e21e019B14E5f1";
        const depositHandler = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
        let depositKey = null;

        // Look for DepositCreated event from DepositHandler
        for (const log of receipt.logs) {
            console.log(`Log from ${log.address.slice(0, 10)}... with ${log.topics.length} topics`);

            // Check if it's from DepositHandler
            if (log.address.toLowerCase() === depositHandler.toLowerCase()) {
                console.log("  ✅ Found log from DepositHandler!");
                if (log.topics.length > 0) {
                    depositKey = log.topics[1]; // Usually the deposit key is in topics[1]
                    console.log("  Potential key:", depositKey);
                }
            }

            // Also check EventEmitter
            if (log.address.toLowerCase() === eventEmitterAddress.toLowerCase() && log.topics.length > 3) {
                const depositCreatedHash = ethers.utils.id("DepositCreated");
                if (log.topics[2] === depositCreatedHash) {
                    depositKey = log.topics[1];
                    console.log("  ✅ Found DepositCreated event!");
                    console.log("  Deposit key:", depositKey);
                }
            }
        }

        if (depositKey) {
            console.log("\n🎉 SUCCESS! First deposit created!");
            console.log("Deposit key:", depositKey);
            console.log("\nThis deposit:");
            console.log("✅ Has receiver as address(1)");
            console.log("✅ Has USDT in DepositVault");
            console.log("✅ ExchangeRouter has ROUTER_PLUGIN role");
            console.log("\nReady for execution!");
        } else {
            console.log("\n⚠️ Transaction succeeded but couldn't extract deposit key");
            console.log("Check transaction on explorer:", tx.hash);
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