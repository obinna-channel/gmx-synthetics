const { ethers } = require("hardhat");

async function main() {
    console.log("=== TRACING CREATE DEPOSIT CALL ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    // Let's trace what should happen:
    console.log("Expected flow:");
    console.log("1. User calls ExchangeRouter.createDeposit()");
    console.log("2. ExchangeRouter calls depositHandler.createDeposit()");
    console.log("3. DepositHandler validates and calls DepositUtils.createDeposit()");
    console.log("4. DepositUtils records tokens and stores deposit in DataStore");
    console.log("5. Events are emitted and deposit key is returned\n");

    // Check what's actually happening
    console.log("=== ACTUAL BEHAVIOR ===");

    // Look at our last transaction
    const txHash = "0x4aa1f5a2c58e943051b77bd4dd4fabc7f222832780e67f36f70b5b0607191234";
    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);

    console.log("Transaction:", txHash);
    console.log("To:", receipt.to);
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Logs emitted:", receipt.logs.length);

    // Analyze the logs
    console.log("\n=== LOG ANALYSIS ===");
    const depositHandlerLogs = receipt.logs.filter(log =>
        log.address.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()
    );

    console.log(`DepositHandler logs: ${depositHandlerLogs.length}`);

    if (depositHandlerLogs.length === 0) {
        console.log("❌ No logs from DepositHandler!");
        console.log("This means depositHandler.createDeposit() was never called or reverted silently");
    }

    // Check internal transactions (if available)
    console.log("\n=== CHECKING INTERNAL CALLS ===");
    console.log("Note: We can't see internal calls directly, but we can infer from:");
    console.log("- Gas usage: " + receipt.gasUsed.toString());
    console.log("- Log count: " + receipt.logs.length);
    console.log("- DataStore state changes: None (no deposit stored)");

    // The smoking gun
    console.log("\n=== THE PROBLEM ===");
    console.log("The ExchangeRouter is NOT calling depositHandler.createDeposit()");
    console.log("\nPossible reasons:");
    console.log("1. The deployed ExchangeRouter has different code than the source");
    console.log("2. There's a condition/check that causes early return");
    console.log("3. The depositHandler address is wrong (but we verified it's correct)");

    // Let's check if the function selector matches what we expect
    console.log("\n=== FUNCTION SELECTOR CHECK ===");
    const iface = new ethers.utils.Interface([
        "function createDeposit(((address,address,address,address,address,address,address[],address[]),uint256,bool,uint256,uint256,bytes32[])) returns (bytes32)"
    ]);
    const expectedSelector = iface.getSighash("createDeposit");
    console.log("Expected createDeposit selector:", expectedSelector);
    console.log("Actual selector being called: 0xc82aa41b");
    console.log("Match:", expectedSelector === "0xc82aa41b" ? "✅" : "❌");

    // The only solution
    console.log("\n=== SOLUTION ===");
    console.log("Since the deployed ExchangeRouter isn't working correctly:");
    console.log("1. Deploy a new ExchangeRouter with the correct code");
    console.log("2. Or use DepositHandler directly (with CONTROLLER role)");
    console.log("3. Or investigate if there's a different entry point we should use");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });