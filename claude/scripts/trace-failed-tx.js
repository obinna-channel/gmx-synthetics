const { ethers } = require("hardhat");

async function main() {
    console.log("=== Tracing Failed Transaction ===\n");
    
    const txHash = "0x2d8c9dd4114c7231c71bb43ab95a8d8f77f686870e0c754ba150c5f09ba69b02";
    console.log("Transaction:", txHash);
    
    const provider = ethers.provider;
    
    // Get the transaction
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log("\nTransaction details:");
    console.log("  From:", tx.from);
    console.log("  To:", tx.to);
    console.log("  Status:", receipt.status === 1 ? "Success" : "Failed ❌");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas used:", receipt.gasUsed.toString());
    console.log("  Gas limit:", tx.gasLimit.toString());
    
    // Try to get the revert reason using debug_traceTransaction
    console.log("\n🔍 Attempting to trace transaction...");
    
    try {
        // Try eth_call with the same data to get revert reason
        console.log("\nReplaying transaction with eth_call to get revert reason...");
        
        const callResult = await provider.call({
            from: tx.from,
            to: tx.to,
            data: tx.data,
            gasLimit: tx.gasLimit
        }, tx.blockNumber - 1); // Call at the block before to simulate same state
        
        console.log("Call result:", callResult);
    } catch (error) {
        console.log("\n❌ Revert reason from eth_call:");
        if (error.error && error.error.data) {
            const errorData = error.error.data;
            console.log("  Error data:", errorData);
            
            // Try to decode the error
            const errorSig = errorData.slice(0, 10);
            console.log("  Error signature:", errorSig);
            
            // Common GMX error signatures
            const errorSignatures = {
                "0xa35b150b": "Unauthorized(address,string)",
                "0xd84b8ee8": "OracleBlockNumbersAreSmallerThanRequired",
                "0xdd51dc73": "EndOfOracleSimulation",
                "0x01af8c24": "EmptyDepositAmounts",
                "0x3c6be8c0": "InsufficientWntAmountForExecutionFee",
                "0xded099de": "EmptyPrimaryPrice",
                "0x9f678cca": "DisabledFeature",
                "0x8a68c1dc": "OracleBlockNumbersAreNotEqual",
                "0x3e237976": "InvalidPriceFormat"
            };
            
            if (errorSignatures[errorSig]) {
                console.log("  \n🎯 Decoded error:", errorSignatures[errorSig]);
                
                // Try to decode parameters for specific errors
                if (errorSig === "0xa35b150b") {
                    // Unauthorized
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                        ["address", "string"],
                        "0x" + errorData.slice(10)
                    );
                    console.log("    Address:", decoded[0]);
                    console.log("    Required role:", decoded[1]);
                } else if (errorSig === "0xd84b8ee8") {
                    // OracleBlockNumbersAreSmallerThanRequired
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                        ["uint256", "uint256", "uint256"],
                        "0x" + errorData.slice(10)
                    );
                    console.log("    Current block:", decoded[0].toString());
                    console.log("    Required min:", decoded[1].toString());
                    console.log("    Difference:", decoded[2].toString());
                }
            } else {
                console.log("  Unknown error signature. Raw data:", errorData);
            }
        } else {
            console.log("  Could not extract error data:", error.message);
        }
    }
    
    // Check if there are any events
    if (receipt.logs.length > 0) {
        console.log("\n📋 Transaction logs:");
        receipt.logs.forEach((log, i) => {
            console.log(`  Log ${i}:`);
            console.log("    Address:", log.address);
            console.log("    Topics:", log.topics);
            console.log("    Data:", log.data);
        });
    } else {
        console.log("\n📋 No events emitted (transaction reverted early)");
    }
}

main().catch(console.error);