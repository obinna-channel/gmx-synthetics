const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEPOSIT WITH BOTH LONG AND SHORT TOKENS (SAME TOKEN) ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        ROUTER: "0x200882043647295a21F9202f9C1535BfB2A2f127",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    // For a balanced deposit, split the amount between long and short
    // Even though it's the same token (USDT), the protocol tracks them separately
    const totalAmount = ethers.utils.parseUnits("100", 6); // 100 USDT total
    const longAmount = ethers.utils.parseUnits("50", 6);   // 50 USDT for long side
    const shortAmount = ethers.utils.parseUnits("50", 6);  // 50 USDT for short side
    const executionFee = ethers.utils.parseEther("0.001");

    // Check balance
    const usdtBalance = await usdt.balanceOf(signer.address);
    console.log("USDT Balance:", ethers.utils.formatUnits(usdtBalance, 6), "USDT");

    // Transfer total USDT to DepositVault
    console.log("\n1. Transferring USDT to DepositVault...");
    console.log("   Total: 100 USDT (50 long + 50 short)");
    const transferTx = await usdt.transfer(ADDRESSES.DEPOSIT_VAULT, totalAmount);
    await transferTx.wait();
    console.log("✓ Transferred");

    // Verify the transfer
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("DepositVault balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Create deposit parameters
    // IMPORTANT: For single-token markets, provide USDT for BOTH long and short
    const depositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,   // USDT for long
            initialShortToken: ADDRESSES.USDT,  // USDT for short (NOT AddressZero!)
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: executionFee,
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n2. Creating deposit with both sides...");
    console.log("  Market:", depositParams.addresses.market);
    console.log("  Long token:", depositParams.addresses.initialLongToken);
    console.log("  Short token:", depositParams.addresses.initialShortToken);
    console.log("  Execution fee:", ethers.utils.formatEther(executionFee), "ETH");

    try {
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            {
                value: executionFee,
                gasLimit: 3000000
            }
        );

        console.log("\n✅ Transaction sent!");
        console.log("Transaction hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("✓ Transaction confirmed");
        console.log("Block number:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        if (receipt.status === 1) {
            console.log("\n🎉 DEPOSIT CREATED SUCCESSFULLY!");

            // Look for the deposit key in logs
            const depositCreatedTopic = ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)");
            const depositEvent = receipt.logs?.find(log =>
                log.topics[0] === depositCreatedTopic
            );

            if (depositEvent) {
                const depositKey = depositEvent.topics[1];
                console.log("\nDeposit key:", depositKey);
                console.log("\n✅ SUCCESS! Deposit created and waiting for keeper execution.");
                console.log("   The system will now recognize both long and short token amounts.");
            }
        } else {
            console.log("\n❌ Transaction reverted");
        }

    } catch (error) {
        console.log("\n❌ Error creating deposit");
        console.log("Error:", error.message);

        if (error.error && error.error.data) {
            console.log("Revert data:", error.error.data);
        }
    }

    // Check final balance
    const finalBalance = await usdt.balanceOf(signer.address);
    console.log("\nFinal USDT Balance:", ethers.utils.formatUnits(finalBalance, 6), "USDT");
    const spent = usdtBalance.sub(finalBalance);
    console.log("USDT spent:", ethers.utils.formatUnits(spent, 6), "USDT");
}

main().catch(console.error);