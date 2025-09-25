const { ethers } = require("hardhat");

async function main() {
    console.log("=== TRACING DEPOSIT FAILURE ===\n");

    const txHash = "0xe88000db2fc61399ad636726bc2714b44f5ce98fec9b5c39c43d3cc94c6ba122";
    
    console.log("Getting transaction trace...");
    
    // Use debug_traceTransaction if available
    try {
        const trace = await ethers.provider.send("debug_traceTransaction", [
            txHash,
            { tracer: "callTracer" }
        ]);
        console.log("Trace:", JSON.stringify(trace, null, 2));
    } catch (e) {
        console.log("debug_traceTransaction not available");
    }
    
    // Get the transaction and try to replay it
    const tx = await ethers.provider.getTransaction(txHash);
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    console.log("\nTransaction details:");
    console.log("  From:", tx.from);
    console.log("  To:", tx.to);
    console.log("  Value:", ethers.utils.formatEther(tx.value), "ETH");
    console.log("  Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("  Gas used:", receipt.gasUsed.toString());
    console.log("  Gas limit:", tx.gasLimit.toString());
    
    // Decode the input data
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const exchangeRouter = await ethers.getContractAt("ExchangeRouter", EXCHANGE_ROUTER);
    
    try {
        const decoded = exchangeRouter.interface.parseTransaction({ data: tx.data });
        console.log("\nFunction called:", decoded.name);
        console.log("Parameters:");
        console.log("  Market:", decoded.args.params.addresses.market);
        console.log("  Long token:", decoded.args.params.addresses.initialLongToken);
        console.log("  Short token:", decoded.args.params.addresses.initialShortToken);
    } catch (e) {
        console.log("Could not decode input");
    }
    
    // Try eth_call with the same data to get error
    console.log("\nReplaying transaction to get error...");
    try {
        await ethers.provider.call({
            from: tx.from,
            to: tx.to,
            data: tx.data,
            value: tx.value
        });
    } catch (error) {
        if (error.data) {
            // Try to extract readable error
            const errorData = error.data;
            if (typeof errorData === 'string' && errorData.length > 10) {
                console.log("Error data length:", errorData.length);
                
                // Look for readable strings in the data
                const hexString = errorData.startsWith('0x') ? errorData.slice(2) : errorData;
                const bytes = [];
                for (let i = 0; i < hexString.length; i += 2) {
                    bytes.push(parseInt(hexString.substr(i, 2), 16));
                }
                
                let readable = '';
                for (const byte of bytes) {
                    if (byte >= 32 && byte <= 126) {
                        readable += String.fromCharCode(byte);
                    }
                }
                
                if (readable.length > 4) {
                    console.log("\nReadable error fragments:", readable);
                }
            }
        }
    }
}

main().catch(console.error);
