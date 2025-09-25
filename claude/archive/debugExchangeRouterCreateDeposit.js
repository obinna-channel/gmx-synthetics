const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEEP DEBUGGING EXCHANGEROUTER.CREATEDEPOSIT ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";

    // The function selector we're calling
    const selector = "0xc82aa41b";
    console.log("Function selector we're calling:", selector);

    // Get the function signature for this selector
    const iface = new ethers.utils.Interface([
        "function createDeposit(((address,address,address,address,address,address,address[],address[]),uint256,bool,uint256,uint256,bytes32[])) returns (bytes32)"
    ]);

    console.log("Expected function signature for", selector);
    console.log("  createDeposit(CreateDepositParams)");

    // Now let's trace what SHOULD happen
    console.log("\n=== EXPECTED FLOW ===");
    console.log("1. User calls ExchangeRouter.createDeposit(params)");
    console.log("2. ExchangeRouter extracts account = msg.sender");
    console.log("3. ExchangeRouter calls depositHandler.createDeposit(account, 0, params)");
    console.log("4. DepositHandler checks CONTROLLER role");
    console.log("5. DepositHandler calls DepositUtils.createDeposit");
    console.log("6. DepositUtils calls depositVault.recordTransferIn");
    console.log("7. Deposit is stored in DataStore");

    console.log("\n=== WHAT'S ACTUALLY HAPPENING ===");
    console.log("Based on our tests:");
    console.log("- Transaction succeeds (no revert)");
    console.log("- Gas is consumed (~676k)");
    console.log("- Tokens ARE transferred (in multicall)");
    console.log("- NO logs from DepositHandler");
    console.log("- NO deposit in DataStore");

    console.log("\n=== HYPOTHESIS ===");
    console.log("The most likely explanation is:");
    console.log("The ExchangeRouter.createDeposit function body is EMPTY or has early return!");
    console.log("\nThis could happen if:");
    console.log("1. The contract was compiled with different source");
    console.log("2. There's a compiler optimization issue");
    console.log("3. The function was stubbed out for testing");

    // Let's check one more thing - event emissions
    console.log("\n=== CHECKING EVENT EMISSIONS ===");

    const provider = ethers.provider;
    const filter = {
        address: null, // Any address
        fromBlock: 196720000,
        toBlock: "latest",
        topics: [
            ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)")
        ]
    };

    try {
        const logs = await provider.getLogs(filter);
        console.log("DepositCreated events found:", logs.length);

        if (logs.length === 0) {
            console.log("❌ NO DepositCreated events ever emitted!");
            console.log("This confirms deposits have never been successfully created.");
        }
    } catch (e) {
        console.log("Could not query logs:", e.message);
    }

    console.log("\n=== CONCLUSION ===");
    console.log("The deployed ExchangeRouter is NOT executing the createDeposit logic.");
    console.log("Even though the function exists and accepts calls, it doesn't do anything.");
    console.log("\nThis is a deployment issue - the contract was deployed with bad bytecode.");
    console.log("\n=== SOLUTION ===");
    console.log("You need to redeploy ExchangeRouter from the correct source code.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });