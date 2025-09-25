const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Creating First Deposit with 1 USDT (Testing Smaller Amount) ===\n");
    console.log("Signer address:", signer.address);

    // Contract addresses from deployment
    const EXCHANGE_ROUTER = "0x28402e44267854D8B7CAD5969BB45eB8aF18663e";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";

    // Get contracts
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Step 1: Check USDT balance in DepositVault
    console.log("Step 1: Checking USDT balance in DepositVault...");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    if (vaultBalance.lt(ethers.utils.parseUnits("1", 6))) {
        console.log("  ⚠️  DepositVault needs at least 1 USDT");
        console.log("  Transferring 1 USDT to DepositVault...");

        const transferAmount = ethers.utils.parseUnits("1", 6);
        const tx = await usdt.transfer(DEPOSIT_VAULT, transferAmount);
        console.log("  Transfer tx:", tx.hash);
        await tx.wait();
        console.log("  ✅ Transfer complete\n");
    } else {
        console.log("  ✅ Sufficient USDT in vault\n");
    }

    // Step 2: Create deposit parameters based on Deposit_Issue_Update.md findings
    console.log("Step 2: Creating deposit parameters...");

    // Key findings from the update:
    // 1. executionFee MUST be 0 (not sending ETH value)
    // 2. receiver MUST be address(1) for first deposit
    // 3. Both initialLongToken and initialShortToken must be USDT (not AddressZero)

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001", // address(1) required for first deposit
            callbackContract: ethers.constants.AddressZero,
            uiFeeReceiver: ethers.constants.AddressZero,
            market: MARKET,
            initialLongToken: USDT,
            initialShortToken: USDT, // MUST be USDT, not AddressZero for single-token markets
            longTokenSwapPath: [],
            shortTokenSwapPath: []
        },
        minMarketTokens: 0,
        shouldUnwrapNativeToken: false,
        executionFee: 0, // MUST be 0 based on discovery
        callbackGasLimit: 0,
        dataList: []
    };

    console.log("  Deposit params:");
    console.log("    Market:", MARKET);
    console.log("    Long token (USDT):", USDT);
    console.log("    Short token (USDT):", USDT);
    console.log("    Amount: 1 USDT (testing if smaller amount works)");
    console.log("    Receiver:", depositParams.addresses.receiver, "(address(1) - required for first deposit)");
    console.log("    Execution fee:", depositParams.executionFee, "(must be 0)");

    // Step 3: Call createDeposit WITHOUT sending ETH
    console.log("\nStep 3: Calling createDeposit on ExchangeRouter...");
    console.log("  NOT sending any ETH (fee = 0 discovery)");

    try {
        const depositTx = await exchangeRouter.createDeposit(depositParams);
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

        console.log("\n✅ SUCCESS! First deposit created with 1 USDT!");
        console.log("\n📝 Transaction hash:", depositTx.hash);
        console.log("\n⏳ Note: The deposit has been CREATED but not yet EXECUTED.");
        console.log("   A keeper needs to execute it with oracle prices.");
        console.log("\n🔑 Testing with 1 USDT to see if the 0x95b66fe9 error is related to deposit size");

    } catch (error) {
        console.log("\n❌ Error creating deposit:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
        if (error.error && error.error.data) {
            console.log("Revert data:", error.error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });