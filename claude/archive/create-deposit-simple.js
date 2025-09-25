const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating First Deposit (Simplified) ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses from deployment
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const ROUTER = "0xAE75C18248905dB5E1ceE00c4655Feb49BA25252";

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const router = await ethers.getContractAt("Router", ROUTER);

    // Step 1: Check USDT balance
    console.log("Step 1: Checking USDT balance...");
    const balance = await usdt.balanceOf(signer.address);
    console.log("  USDT balance:", ethers.utils.formatUnits(balance, 6), "USDT");

    if (balance.lt(ethers.utils.parseUnits("100", 6))) {
        console.log("  ❌ Insufficient USDT balance. Need at least 100 USDT");
        return;
    }

    // Step 2: Approve USDT to Router
    console.log("\nStep 2: Approving USDT to Router...");
    const depositAmount = ethers.utils.parseUnits("100", 6); // 100 USDT

    const currentAllowance = await usdt.allowance(signer.address, ROUTER);
    console.log("  Current allowance:", ethers.utils.formatUnits(currentAllowance, 6), "USDT");

    if (currentAllowance.lt(depositAmount)) {
        const approveTx = await usdt.approve(ROUTER, depositAmount);
        console.log("  Approval tx:", approveTx.hash);
        await approveTx.wait();
        console.log("  ✅ Approved", ethers.utils.formatUnits(depositAmount, 6), "USDT to Router\n");
    } else {
        console.log("  ✅ Already approved\n");
    }

    // Step 3: Send USDT to DepositVault via Router
    console.log("Step 3: Sending USDT to DepositVault via Router...");
    const depositVault = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794"; // DepositVault address

    try {
        const transferTx = await router.sendTokens(USDT, depositVault, depositAmount);
        console.log("  Transfer tx:", transferTx.hash);
        await transferTx.wait();
        console.log("  ✅ Sent", ethers.utils.formatUnits(depositAmount, 6), "USDT to DepositVault\n");
    } catch (error) {
        console.log("  ⚠️  Note: Transfer might have failed, but continuing...\n");
    }

    // Step 4: Create deposit parameters
    console.log("Step 4: Creating deposit parameters...");

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1) for first deposit
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
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("  Deposit params:");
    console.log("    Market:", MARKET);
    console.log("    Long token (USDT):", USDT);
    console.log("    Short token (USDT):", USDT);
    console.log("    Amount:", ethers.utils.formatUnits(depositAmount, 6), "USDT");
    console.log("    Receiver:", depositParams.addresses.receiver);
    console.log("    Execution fee:", ethers.utils.formatEther(depositParams.executionFee), "ETH");

    // Step 5: Call createDeposit
    console.log("\nStep 5: Calling createDeposit on ExchangeRouter...");

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams, {
            value: depositParams.executionFee
        });
        console.log("  Transaction sent:", depositTx.hash);

        const receipt = await depositTx.wait();
        console.log("  Transaction confirmed in block:", receipt.blockNumber);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Check for events
        if (receipt.events && receipt.events.length > 0) {
            console.log("\n  Events emitted:");
            for (const event of receipt.events) {
                if (event.event) {
                    console.log("    -", event.event);
                }
            }
        }

        console.log("\n✅ SUCCESS! Deposit created successfully!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n⏳ Note: The deposit has been CREATED but not yet EXECUTED.");
        console.log("   A keeper needs to execute it with oracle prices.");

    } catch (error) {
        console.log("\n❌ Error creating deposit:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });