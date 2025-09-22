const { ethers } = require("hardhat");

async function main() {
    console.log("=== SIMPLE DEPOSIT TEST - STANDARD FLOW ===\n");

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

    // Step 1: Check balance
    const usdtBalance = await usdt.balanceOf(signer.address);
    console.log("USDT Balance:", ethers.utils.formatUnits(usdtBalance, 6), "USDT");

    // Step 2: Approve Router (NOT ExchangeRouter)
    console.log("\n1. Approving Router to spend USDT...");
    const approveTx = await usdt.approve(ADDRESSES.ROUTER, depositAmount);
    await approveTx.wait();
    console.log("✓ Approved");

    // Verify allowance
    const allowance = await usdt.allowance(signer.address, ADDRESSES.ROUTER);
    console.log("Allowance set:", ethers.utils.formatUnits(allowance, 6), "USDT");

    // Step 3: Create deposit directly
    console.log("\n2. Creating deposit through ExchangeRouter...");

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
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("Deposit params:");
    console.log("  Market:", depositParams.addresses.market);
    console.log("  Receiver:", depositParams.addresses.receiver);
    console.log("  Initial long token:", depositParams.addresses.initialLongToken);
    console.log("  Execution fee:", ethers.utils.formatEther(depositParams.executionFee), "ETH");

    try {
        // Send the transaction with execution fee as value
        const tx = await exchangeRouter.createDeposit(
            depositParams,
            {
                value: depositParams.executionFee,
                gasLimit: 2000000 // Set explicit gas limit
            }
        );

        console.log("\n✅ Transaction sent!");
        console.log("Transaction hash:", tx.hash);

        const receipt = await tx.wait();
        console.log("✓ Transaction confirmed");
        console.log("Gas used:", receipt.gasUsed.toString());

        // Check for events
        console.log("\nEvents emitted:", receipt.events?.length || 0);
        receipt.events?.forEach((event, i) => {
            if (event.event) {
                console.log(`  ${i + 1}. ${event.event}`);
            }
        });

        // Look for deposit key
        const depositCreatedTopic = ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)");
        const depositEvent = receipt.logs?.find(log =>
            log.topics[0] === depositCreatedTopic
        );

        if (depositEvent) {
            console.log("\nDeposit created successfully!");
            console.log("Deposit key:", depositEvent.topics[1]);
        }

    } catch (error) {
        console.log("\n❌ Transaction failed");
        console.log("Error:", error.message);

        if (error.error && error.error.data) {
            console.log("\nError data:", error.error.data);
        }
    }

    // Check final balance
    const finalBalance = await usdt.balanceOf(signer.address);
    console.log("\n3. Final USDT Balance:", ethers.utils.formatUnits(finalBalance, 6), "USDT");
    const spent = usdtBalance.sub(finalBalance);
    console.log("USDT spent:", ethers.utils.formatUnits(spent, 6), "USDT");
}

main().catch(console.error);