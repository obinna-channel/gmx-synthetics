const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING IF EMPTY DEPOSIT AMOUNTS IS THE ISSUE ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d",
        DEPOSIT_HANDLER: "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827"
    };

    const [signer] = await ethers.getSigners();
    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    // Check vault balance
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("Current DepositVault balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    console.log("(This is from previous failed attempts)\n");

    // The issue might be that DepositUtils.createDeposit() calls:
    // depositVault.recordTransferIn() which only counts NEW transfers
    // The 1001 USDT already there won't be counted!

    console.log("Theory: The deposit is failing because recordTransferIn() returns 0");
    console.log("since no NEW tokens were transferred in this transaction.\n");

    // Let's transfer a small amount of NEW USDT to test this
    const testAmount = ethers.utils.parseUnits("10", 6); // 10 USDT

    console.log("1. Transferring 10 NEW USDT to DepositVault...");
    const transferTx = await usdt.transfer(ADDRESSES.DEPOSIT_VAULT, testAmount);
    await transferTx.wait();
    console.log("✓ Transferred");

    const newVaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("New vault balance:", ethers.utils.formatUnits(newVaultBalance, 6), "USDT");

    // Now try to create deposit with high execution fee
    const depositParams = {
        addresses: {
            receiver: signer.address,
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
        executionFee: ethers.utils.parseEther("0.01"), // Use high fee to avoid that issue
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n2. Creating deposit (with 10 USDT just transferred)...");
    try {
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            {
                value: ethers.utils.parseEther("0.01"),
                gasLimit: 3000000
            }
        );

        console.log("\n✅ Transaction sent!");
        console.log("Transaction hash:", tx.hash);

        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log("\n🎉 SUCCESS! DEPOSIT CREATED!");
            console.log("Block:", receipt.blockNumber);
            console.log("Gas used:", receipt.gasUsed.toString());

            // Find deposit key
            const depositCreatedTopic = ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)");
            const depositEvent = receipt.logs?.find(log =>
                log.topics[0] === depositCreatedTopic
            );

            if (depositEvent) {
                console.log("\n=== DEPOSIT SUCCESS ===");
                console.log("Deposit Key:", depositEvent.topics[1]);
                console.log("\nThe issue WAS that recordTransferIn() needs NEW tokens!");
                console.log("The 1001 USDT already in vault couldn't be used.");
            }
        } else {
            console.log("\n❌ Transaction reverted");
            console.log("Even with new tokens, it still fails");
        }

    } catch (error) {
        console.log("\n❌ Still failing even with new tokens!");
        console.log("Error:", error.reason || error.message);
    }
}

main().catch(console.error);