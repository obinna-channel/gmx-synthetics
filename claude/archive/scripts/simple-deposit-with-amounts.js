const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEPOSIT TEST WITH AMOUNTS ===\n");

    const ADDRESSES = {
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        MARKET: "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970",
        ROUTER: "0x200882043647295a21F9202f9C1535BfB2A2f127",
        EXCHANGE_ROUTER: "0x59b94d5B4686D59a4665d1679A8E27F71c544F40"
    };

    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);

    const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", ADDRESSES.EXCHANGE_ROUTER);

    const depositAmount = ethers.utils.parseUnits("100", 6); // 100 USDT

    // Check balance
    const usdtBalance = await usdt.balanceOf(signer.address);
    console.log("USDT Balance:", ethers.utils.formatUnits(usdtBalance, 6), "USDT");

    // Approve Router
    console.log("\nApproving Router to spend USDT...");
    const approveTx = await usdt.approve(ADDRESSES.ROUTER, depositAmount);
    await approveTx.wait();
    console.log("✓ Approved");

    // Check if we need to send WETH as execution fee
    // For now, let's send a small amount of ETH
    const executionFee = ethers.utils.parseEther("0.001");

    // Create deposit parameters
    // For a single-sided deposit (only USDT, no short token)
    const depositParams = {
        addresses: {
            receiver: signer.address,
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: ADDRESSES.MARKET,
            initialLongToken: ADDRESSES.USDT,
            initialShortToken: ethers.constants.AddressZero,
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: executionFee,
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("\nDeposit Configuration:");
    console.log("  Market:", depositParams.addresses.market);
    console.log("  Long token (USDT):", depositParams.addresses.initialLongToken);
    console.log("  Short token:", depositParams.addresses.initialShortToken);
    console.log("  Amount: 100 USDT (approved to Router)");
    console.log("  Execution fee:", ethers.utils.formatEther(executionFee), "ETH");

    // First, let's check what the sendWnt and sendTokens functions expect
    console.log("\nAttempting to create deposit...");

    try {
        // The createDeposit function should pull tokens from the user
        // through the Router's transferFrom capability
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
            console.log("\n🎉 Deposit created successfully!");

            // Look for events
            if (receipt.events && receipt.events.length > 0) {
                console.log("\nEvents emitted:");
                receipt.events.forEach((event, i) => {
                    if (event.event) {
                        console.log(`  ${i + 1}. ${event.event}`);
                    }
                });
            }
        } else {
            console.log("\n❌ Transaction reverted");
        }

    } catch (error) {
        console.log("\n❌ Error creating deposit");
        console.log("Error message:", error.message);

        // If it's a revert, try to get more details
        if (error.data) {
            console.log("Error data:", error.data);
        }

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