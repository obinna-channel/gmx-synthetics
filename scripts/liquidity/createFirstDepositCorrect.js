const { ethers } = require("hardhat");

async function main() {
    console.log("=== CREATING FIRST DEPOSIT CORRECTLY - ADDRESS(1) + DEPOSITVAULT ===\n");

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

    // Check balances
    const signerBalance = await usdt.balanceOf(signer.address);
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);

    console.log("=== CURRENT STATE ===");
    console.log("Your USDT:", ethers.utils.formatUnits(signerBalance, 6), "USDT");
    console.log("DepositVault USDT:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Transfer 50 USDT to DEPOSIT_VAULT (not ExchangeRouter!)
    const amount = ethers.utils.parseUnits("50", 6);
    console.log("\nTransferring 50 USDT to DepositVault...");

    const transferTx = await usdt.transfer(ADDRESSES.DEPOSIT_VAULT, amount);
    await transferTx.wait();
    console.log("✅ Transferred 50 USDT to DepositVault");

    // Create deposit with receiver as address(1)
    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // ADDRESS(1) for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,  // Both USDT
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0,  // No execution fee
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n=== DEPOSIT PARAMETERS ===");
    console.log("Receiver: address(1) - REQUIRED FOR FIRST DEPOSIT");
    console.log("Market:", ADDRESSES.MARKET);
    console.log("Tokens: Both USDT");
    console.log("Execution Fee: 0");
    console.log("USDT in DepositVault: Will use the 50 we just sent");

    try {
        console.log("\n=== CREATING DEPOSIT ===");
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            {
                value: 0,  // No ETH
                gasLimit: 1000000
            }
        );

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();

        console.log("\n✅ Transaction confirmed!");
        console.log("Block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Extract deposit key
        console.log("\n=== EXTRACTING DEPOSIT KEY ===");
        const eventEmitterAddress = "0xE4fFaF6533F6044Fd4E7e19D60e21e019B14E5f1";
        let depositKey = null;

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === eventEmitterAddress.toLowerCase()) {
                if (log.topics.length >= 3) {
                    const depositCreatedHash = ethers.utils.id("DepositCreated");
                    if (log.topics[2] === depositCreatedHash) {
                        depositKey = log.topics[1];
                        console.log("✅ Deposit key:", depositKey);
                        break;
                    }
                }
            }
        }

        console.log("\n🎉 SUCCESS!");
        console.log("First deposit created with:");
        console.log("- Receiver as address(1) ✓");
        console.log("- USDT in DepositVault ✓");
        console.log("- Ready for execution!");

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