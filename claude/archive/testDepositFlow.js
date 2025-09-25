const { ethers } = require("hardhat");

async function main() {
    console.log("=== TESTING COMPLETE DEPOSIT FLOW ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const DEPOSIT_VAULT = "0x9986771384aeA06185960C5CACA7AFcb47bCC47d";
    const ROUTER = "0x200882043647295a21F9202f9C1535BfB2A2f127";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);

    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    const depositVault = await ethers.getContractAt("StrictBank", DEPOSIT_VAULT);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check initial state
    console.log("=== INITIAL STATE ===");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const storedBalance = await depositVault.tokenBalances(USDT);
    console.log("USDT in vault:", ethers.utils.formatUnits(vaultBalance, 6));
    console.log("Stored balance:", ethers.utils.formatUnits(storedBalance, 6));

    // The key insight: DepositUtils.createDeposit calls recordTransferIn
    // This expects tokens to be transferred IN THE SAME TRANSACTION
    // But we've been transferring tokens in separate transactions!

    console.log("\n=== THE PROBLEM ===");
    console.log("When DepositUtils calls recordTransferIn:");
    console.log("- It compares current balance to stored balance");
    console.log("- If no new tokens arrived IN THIS TX, it returns 0");
    console.log("- With 0 tokens, the deposit is considered empty and fails");

    console.log("\n=== THE SOLUTION ===");
    console.log("We need to transfer tokens and create deposit in the SAME transaction.");
    console.log("This requires using ExchangeRouter.multicall or a custom contract.");

    // Let's try the CORRECT flow
    console.log("\n=== ATTEMPTING CORRECT FLOW ===");

    // Step 1: Approve Router (not ExchangeRouter)
    const amount = ethers.utils.parseUnits("50", 6);
    console.log("1. Approving Router for 50 USDT...");
    const approveTx = await usdt.approve(ROUTER, amount);
    await approveTx.wait();
    console.log("   ✅ Approved");

    // Step 2: Use multicall to do both operations
    console.log("\n2. Preparing multicall...");

    const depositParams = {
        addresses: {
            receiver: "0x0000000000000000000000000000000000000001",
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
        executionFee: 0,
        callbackGasLimit: 0,
        dataList: []
    };

    // Encode the calls
    const sendTokensData = exchangeRouter.interface.encodeFunctionData("sendTokens", [
        USDT,
        DEPOSIT_VAULT,
        amount
    ]);

    const createDepositData = exchangeRouter.interface.encodeFunctionData("createDeposit", [
        depositParams
    ]);

    console.log("   Call 1: sendTokens to DepositVault");
    console.log("   Call 2: createDeposit");

    // Check if ExchangeRouter has multicall
    try {
        // Try to encode multicall
        const multicallData = exchangeRouter.interface.encodeFunctionData("multicall", [
            [sendTokensData, createDepositData]
        ]);
        console.log("   ✅ Multicall function exists");

        console.log("\n3. Executing multicall...");
        const tx = await exchangeRouter.multicall(
            [sendTokensData, createDepositData],
            { gasLimit: 2000000 }
        );

        console.log("   Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("   ✅ Transaction confirmed!");
        console.log("   Gas used:", receipt.gasUsed.toString());

        // Check for deposit creation
        console.log("\n=== CHECKING FOR DEPOSIT ===");
        let depositCreated = false;

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
                console.log("✅ Found log from DepositHandler!");
                depositCreated = true;
            }
        }

        if (!depositCreated) {
            console.log("❌ No DepositHandler logs - deposit not created");

            // Check what happened to the tokens
            const newVaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
            const diff = newVaultBalance.sub(vaultBalance);
            console.log("Tokens sent to vault:", ethers.utils.formatUnits(diff, 6), "USDT");
        }

    } catch (error) {
        console.log("\n❌ Multicall failed:", error.message);

        if (error.message.includes("multicall is not a function")) {
            console.log("\n⚠️ ExchangeRouter doesn't have multicall!");
            console.log("This is a major problem - we can't do atomic operations.");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });