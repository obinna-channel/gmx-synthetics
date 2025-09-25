const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating First Deposit ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses from deployment
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const ORACLE = "0xcA051377254B642bE843DeD131de48206db63f94";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const ROUTER = "0xAE75C18248905dB5E1ceE00c4655Feb49BA25252";

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const router = await ethers.getContractAt("Router", ROUTER);

    // Step 1: Push prices to Oracle
    console.log("Step 1: Pushing prices to Oracle...");

    const tokens = [USDT, sNGN];
    const precisions = [
        ethers.utils.parseUnits("1", "12"), // USDT has 6 decimals, precision factor = 10^12
        ethers.utils.parseUnits("1", "0")   // sNGN has 18 decimals, precision factor = 1
    ];
    const minPrices = [
        ethers.utils.parseUnits("1", "30"),    // USDT = $1 (with 30 decimals)
        ethers.utils.parseUnits("0.000666", "30") // sNGN = $0.000666 (1 USDT = 1500 NGN)
    ];
    const maxPrices = minPrices; // Same prices for min and max

    const oracleParams = {
        signerInfo: 0, // Compact signer info
        tokens: tokens,
        compactedMinOracleBlockNumbers: [0, 0], // Not checking block numbers
        compactedMaxOracleBlockNumbers: [0, 0],
        compactedOracleTimestamps: [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)],
        compactedDecimals: [6, 18], // USDT has 6, sNGN has 18 decimals
        compactedMinPrices: minPrices.map(p => p.div(ethers.utils.parseUnits("1", "12"))), // Compact to 18 decimals
        compactedMinPricesIndexes: [0, 0],
        compactedMaxPrices: maxPrices.map(p => p.div(ethers.utils.parseUnits("1", "12"))), // Compact to 18 decimals
        compactedMaxPricesIndexes: [0, 0],
        signatures: ["0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"],
        priceFeedTokens: []
    };

    try {
        const priceTx = await oracle.setPrices(signer.address, oracleParams);
        console.log("  Price update tx:", priceTx.hash);
        await priceTx.wait();
        console.log("  ✅ Prices pushed successfully\n");
    } catch (error) {
        console.log("  ❌ Error pushing prices:", error.message);
        return;
    }

    // Step 2: Check USDT balance
    console.log("Step 2: Checking USDT balance...");
    const balance = await usdt.balanceOf(signer.address);
    console.log("  USDT balance:", ethers.utils.formatUnits(balance, 6), "USDT");

    if (balance.lt(ethers.utils.parseUnits("100", 6))) {
        console.log("  ❌ Insufficient USDT balance. Need at least 100 USDT");
        return;
    }

    // Step 3: Approve USDT to Router
    console.log("\nStep 3: Approving USDT to Router...");
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

    // Step 4: Send USDT to OrderVault
    console.log("Step 4: Sending USDT to OrderVault via Router...");
    const orderVault = "0x178D60C2F07aECC786DA3d7f7027398c2142263C";

    try {
        const transferTx = await router.sendTokens(USDT, orderVault, depositAmount);
        console.log("  Transfer tx:", transferTx.hash);
        await transferTx.wait();
        console.log("  ✅ Sent", ethers.utils.formatUnits(depositAmount, 6), "USDT to OrderVault\n");
    } catch (error) {
        console.log("  ⚠️  Note: Transfer might have failed, but continuing...\n");
    }

    // Step 5: Create deposit parameters
    console.log("Step 5: Creating deposit...");

    const depositParams = {
        receiver: "0x0000000000000000000000000000000000000001", // address(1) for first deposit
        callbackContract: ethers.constants.AddressZero,
        uiFeeReceiver: ethers.constants.AddressZero,
        market: MARKET,
        initialLongToken: USDT,
        initialShortToken: USDT,
        longTokenSwapPath: [],
        shortTokenSwapPath: [],
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: ethers.utils.parseEther("0.001"),
        callbackGasLimit: 0
    };

    console.log("  Deposit params:");
    console.log("    Market:", MARKET);
    console.log("    Long token:", USDT);
    console.log("    Short token:", USDT);
    console.log("    Receiver:", depositParams.receiver);
    console.log("    Execution fee:", ethers.utils.formatEther(depositParams.executionFee), "ETH");

    // Step 6: Call createDeposit
    console.log("\nStep 6: Calling createDeposit on ExchangeRouter...");

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