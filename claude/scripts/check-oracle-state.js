const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Oracle State ===\n");
    
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    
    // Get current block
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("Current blockchain state:");
    console.log("  Block number:", currentBlock.number);
    console.log("  Block timestamp:", currentBlock.timestamp);
    
    // Check Oracle timestamps
    console.log("\nOracle timestamps:");
    try {
        const timestamps = await oracle.getTimestamps();
        console.log("  Min timestamp:", timestamps.min.toString());
        console.log("  Max timestamp:", timestamps.max.toString());
        
        // Compare to current
        console.log("\nTimestamp comparison:");
        console.log("  Current - Min:", currentBlock.timestamp - timestamps.min.toNumber(), "seconds ago");
        console.log("  Current - Max:", currentBlock.timestamp - timestamps.max.toNumber(), "seconds ago");
    } catch (e) {
        console.log("  Error reading timestamps:", e.message);
    }
    
    // Check if Oracle tracks block numbers
    console.log("\nChecking for block number tracking...");
    try {
        // Try to read minOracleBlockNumber if it exists
        const minBlockNumber = await oracle.minOracleBlockNumber();
        console.log("  Min oracle block number:", minBlockNumber.toString());
    } catch (e) {
        console.log("  No minOracleBlockNumber function");
    }
    
    try {
        // Try to read maxOracleBlockNumber if it exists
        const maxBlockNumber = await oracle.maxOracleBlockNumber();
        console.log("  Max oracle block number:", maxBlockNumber.toString());
    } catch (e) {
        console.log("  No maxOracleBlockNumber function");
    }
    
    // Check if there's a setCompactedValues function
    console.log("\nChecking Oracle interface for block number setters...");
    const oracleInterface = oracle.interface;
    const functions = Object.keys(oracleInterface.functions);
    
    const blockRelatedFunctions = functions.filter(fn => 
        fn.toLowerCase().includes('block') || 
        fn.toLowerCase().includes('compact')
    );
    
    if (blockRelatedFunctions.length > 0) {
        console.log("  Found block-related functions:");
        blockRelatedFunctions.forEach(fn => {
            console.log("    -", fn);
        });
    } else {
        console.log("  No block-related functions found");
    }
    
    // Look for functions that might set oracle state
    const setterFunctions = functions.filter(fn => fn.startsWith('set'));
    console.log("\nOracle setter functions:");
    setterFunctions.forEach(fn => {
        console.log("  -", fn);
    });
}

main().catch(console.error);