const { ethers } = require("hardhat");

async function main() {
    console.log("=== ANALYZING TRANSACTION ===\n");

    const txHash = "0xc88977f3f0760dd7d4c8dd6e9313f2f981e31bbacb8b362e1630a5500f07b27c";

    const provider = ethers.provider;

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    const tx = await provider.getTransaction(txHash);

    console.log("Transaction Hash:", txHash);
    console.log("Block Number:", receipt.blockNumber);
    console.log("Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
    console.log("To:", tx.to);
    console.log("From:", tx.from);
    console.log();

    // Decode the transaction input to see what was called
    const OrderHandler = await ethers.getContractAt(
        "OrderHandler",
        "0x83f2D66af7f794893C31c0B32BD2D4cE826871d7"
    );

    try {
        const decoded = OrderHandler.interface.parseTransaction({ data: tx.data });
        console.log("Function called:", decoded.name);
        console.log();

        if (decoded.name === "executeOrder") {
            const oracleParams = decoded.args[1]; // OracleUtils.SetPricesParams
            console.log("Oracle Params:");
            console.log("  Tokens:", oracleParams.tokens);
            console.log("  Providers:", oracleParams.providers);
            console.log("  Data length:", oracleParams.data.length);
        }
    } catch (e) {
        console.log("Could not decode transaction:", e.message);
    }

    // Check logs/events
    console.log("\nEvents emitted:", receipt.logs.length);

    // Look for OraclePriceUpdate events
    const Oracle = await ethers.getContractAt(
        "Oracle",
        "0xE89d94669f49D278cCD094A084139eB6639C0a93"
    );

    for (const log of receipt.logs) {
        try {
            const parsed = Oracle.interface.parseLog(log);
            if (parsed.name === "OraclePriceUpdate") {
                console.log("\n  OraclePriceUpdate event:");
                console.log("    Token:", parsed.args.token);
                console.log("    Provider:", parsed.args.provider);
                console.log("    Min Price:", parsed.args.minPrice.toString());
                console.log("    Max Price:", parsed.args.maxPrice.toString());
            }
        } catch (e) {
            // Not an Oracle event, skip
        }
    }
}

main().catch(console.error);
