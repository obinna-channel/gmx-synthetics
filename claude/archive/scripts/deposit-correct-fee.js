const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEPOSIT WITH CORRECT EXECUTION FEE ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40",
        DEPOSIT_VAULT: "0x9986771384aeA06185960C5CACA7AFcb47bCC47d"
    };

    const [signer] = await ethers.getSigners();
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);

    // Check balances
    const usdtBalance = await usdt.balanceOf(signer.address);
    console.log("USDT Balance:", ethers.utils.formatUnits(usdtBalance, 6), "USDT");

    // The DepositVault already has 1001 USDT from our previous attempts
    const vaultBalance = await usdt.balanceOf(ADDRESSES.DEPOSIT_VAULT);
    console.log("DepositVault already has:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // IMPORTANT: Use the correct execution fee
    // Required: 0.0013 ETH (we'll use 0.002 ETH to be safe)
    const executionFee = ethers.utils.parseEther("0.002");
    console.log("Execution fee:", ethers.utils.formatEther(executionFee), "ETH");

    // Create deposit parameters
    const depositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ADDRESSES.USDT,  // Both sides use USDT
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: executionFee,  // Correct fee!
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\n=== CREATING DEPOSIT ===");
    console.log("Market:", ADDRESSES.MARKET);
    console.log("Long token:", ADDRESSES.USDT);
    console.log("Short token:", ADDRESSES.USDT);
    console.log("Execution fee:", ethers.utils.formatEther(executionFee), "ETH");

    try {
        // The contract will use the USDT already in DepositVault
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            {
                value: executionFee,  // Send 0.002 ETH
                gasLimit: 3000000
            }
        );

        console.log("\n✅ Transaction sent!");
        console.log("Transaction hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("✓ Transaction confirmed");
        console.log("Block number:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());
        console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");

        if (receipt.status === 1) {
            console.log("\n🎉 DEPOSIT CREATED SUCCESSFULLY!");

            // Look for events
            if (receipt.events && receipt.events.length > 0) {
                console.log("\nEvents emitted:");
                receipt.events.forEach((event, i) => {
                    if (event.event) {
                        console.log(`  ${i + 1}. ${event.event}`);
                    }
                });
            }

            // Look for deposit key in logs
            const depositCreatedTopic = ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)");
            const depositEvent = receipt.logs?.find(log =>
                log.topics[0] === depositCreatedTopic
            );

            if (depositEvent) {
                const depositKey = depositEvent.topics[1];
                console.log("\n=== DEPOSIT DETAILS ===");
                console.log("Deposit key:", depositKey);
                console.log("\n✅ SUCCESS! The deposit has been created and is waiting for keeper execution.");
                console.log("   The keeper will execute this deposit with oracle prices.");
                console.log("   You will receive GM tokens once executed.");
            }
        }

    } catch (error) {
        console.log("\n❌ Error creating deposit");
        console.log("Error:", error.message);

        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
        }
    }
}

main().catch(console.error);