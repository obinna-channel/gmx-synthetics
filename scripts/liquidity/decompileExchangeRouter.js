const { ethers } = require("hardhat");

async function main() {
    console.log("=== ANALYZING EXCHANGEROUTER BYTECODE ===\n");

    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const provider = ethers.provider;

    // Get the bytecode
    const bytecode = await provider.getCode(EXCHANGE_ROUTER);
    console.log("Bytecode length:", bytecode.length);

    // Look for the createDeposit selector
    const createDepositSelector = "c82aa41b"; // We know this works
    const depositHandlerCreateSelector = "7219bf24"; // DepositHandler.createDeposit selector

    console.log("\n=== SEARCHING FOR FUNCTION CALLS ===");
    console.log("Looking for createDeposit selector (c82aa41b):", bytecode.includes(createDepositSelector));
    console.log("Looking for depositHandler.createDeposit selector (7219bf24):", bytecode.includes(depositHandlerCreateSelector));

    // Check for CALL opcode pattern that would indicate external call
    // In EVM, external calls use CALL (0xf1) or DELEGATECALL (0xf4) or STATICCALL (0xfa)
    const callCount = (bytecode.match(/f1/g) || []).length;
    const delegateCallCount = (bytecode.match(/f4/g) || []).length;
    const staticCallCount = (bytecode.match(/fa/g) || []).length;

    console.log("\n=== OPCODE ANALYSIS ===");
    console.log("CALL opcodes found:", callCount);
    console.log("DELEGATECALL opcodes found:", delegateCallCount);
    console.log("STATICCALL opcodes found:", staticCallCount);

    // Look for the depositHandler address in bytecode
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const dhAddressNormalized = DEPOSIT_HANDLER.toLowerCase().slice(2);
    console.log("\n=== ADDRESS SEARCH ===");
    console.log("Looking for DepositHandler address:", bytecode.includes(dhAddressNormalized));

    // Check immutable values (they're appended at the end of bytecode)
    console.log("\n=== IMMUTABLE VALUES (last 320 bytes) ===");
    const immutableSection = bytecode.slice(-640); // Last 320 bytes in hex (640 chars)
    console.log("Immutable section includes:");

    // Split into 40-char chunks (20 bytes) to look for addresses
    for (let i = 0; i < immutableSection.length; i += 40) {
        const chunk = immutableSection.slice(i, i + 40);
        if (chunk.match(/^[0-9a-f]{40}$/i) && chunk !== "0".repeat(40)) {
            console.log(`  0x${chunk}`);
        }
    }

    // Check if the createDeposit function might be doing something else
    console.log("\n=== HYPOTHESIS ===");
    if (!bytecode.includes(depositHandlerCreateSelector)) {
        console.log("❌ The bytecode does NOT contain calls to depositHandler.createDeposit!");
        console.log("This confirms that ExchangeRouter is not calling DepositHandler.");
        console.log("\nPossible reasons:");
        console.log("1. The contract was compiled with different source code");
        console.log("2. The function body is empty or has a early return");
        console.log("3. Compiler optimizations removed the call");
    } else {
        console.log("✅ Found call to depositHandler.createDeposit");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });