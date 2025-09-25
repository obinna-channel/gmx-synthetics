const { ethers } = require("hardhat");

async function main() {
    console.log("=== CREATING FIRST DEPOSIT WITH ADDRESS(1) - USING PROVEN METHOD ===\n");

    // Using exact addresses from successful deposit
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Check balance
    const balance = await usdt.balanceOf(signer.address);
    console.log("Your USDT balance:", ethers.utils.formatUnits(balance, 6), "USDT");

    // Use fresh 50 USDT like the successful attempt
    const amount = ethers.utils.parseUnits("50", 6);

    console.log("\nTransferring 50 USDT to ExchangeRouter...");
    const transferTx = await usdt.transfer(EXCHANGE_ROUTER, amount);
    await transferTx.wait();
    console.log("✅ Transferred 50 USDT");

    // Create deposit parameters - EXACT same as successful one but with address(1)
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // ONLY CHANGE: address(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,      // Both set to USDT
            initialShortToken: USDT,     // Both set to USDT
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,  // KEY: Set to 0, not sending ETH
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n=== DEPOSIT PARAMETERS ===");
    console.log("Receiver: address(1) - REQUIRED FOR FIRST DEPOSIT");
    console.log("Market:", MARKET);
    console.log("Initial Long Token:", USDT);
    console.log("Initial Short Token:", USDT);
    console.log("Execution Fee: 0 (keeper pays gas)");
    console.log("Amount: 50 USDT");

    try {
        console.log("\n=== CREATING DEPOSIT ===");
        const tx = await exchangeRouter.createDeposit(depositParams, { value: 0 }); // No ETH sent
        console.log("Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed!");
        console.log("Block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Extract deposit key from EventEmitter logs
        console.log("\n=== EXTRACTING DEPOSIT KEY ===");
        const eventEmitterAddress = "0xE4fFaF6533F6044Fd4E7e19D60e21e019B14E5f1";
        let depositKey = null;

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === eventEmitterAddress.toLowerCase()) {
                if (log.topics.length >= 3) {
                    // Check if topics[2] matches keccak256("DepositCreated")
                    const depositCreatedHash = ethers.utils.id("DepositCreated");
                    if (log.topics[2] === depositCreatedHash) {
                        depositKey = log.topics[1];
                        console.log("✅ Deposit key found:", depositKey);
                        break;
                    }
                }
            }
        }

        if (!depositKey) {
            console.log("⚠️ Could not extract deposit key from logs");
        }

        console.log("\n🎉 SUCCESS! First deposit created with receiver as address(1)");
        console.log("This deposit should now be executable without InvalidReceiverForFirstDeposit error");

    } catch (error) {
        console.log("\n❌ Failed to create deposit:", error.message);
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