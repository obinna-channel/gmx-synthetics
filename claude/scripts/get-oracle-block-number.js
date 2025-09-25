const { ethers } = require("hardhat");

async function main() {
    console.log("=== Getting Oracle's Current Block Number ===\n");

    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    // Get current chain block for reference
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("📊 Current Chain Block Number:", currentBlock.number);
    console.log("📊 Current Chain Timestamp:", currentBlock.timestamp);

    console.log("\n🔍 Oracle's Internal State:");

    // Try to get the Oracle's block numbers
    try {
        // Most Oracle contracts track these
        const minOracleBlockNumber = await oracle.minOracleBlockNumber();
        console.log("  Min Oracle Block Number:", minOracleBlockNumber.toString());
    } catch (e) {
        console.log("  Min Oracle Block Number: Not accessible via minOracleBlockNumber()");
    }

    try {
        const maxOracleBlockNumber = await oracle.maxOracleBlockNumber();
        console.log("  Max Oracle Block Number:", maxOracleBlockNumber.toString());
    } catch (e) {
        console.log("  Max Oracle Block Number: Not accessible via maxOracleBlockNumber()");
    }

    // Try alternative function names
    try {
        const latestBlockNumber = await oracle.latestBlockNumber();
        console.log("  Latest Block Number:", latestBlockNumber.toString());
    } catch (e) {
        // Not available
    }

    try {
        const blockNumber = await oracle.blockNumber();
        console.log("  Block Number:", blockNumber.toString());
    } catch (e) {
        // Not available
    }

    // Check if there's a getLatestData function
    try {
        const latestData = await oracle.getLatestData();
        console.log("  Latest Data:", latestData);
    } catch (e) {
        // Not available
    }

    // Try to read storage directly at slot 0, 1, 2 which often contain important state
    console.log("\n📦 Direct Storage Inspection:");
    for (let i = 0; i < 5; i++) {
        try {
            const storageSlot = await ethers.provider.getStorageAt(ORACLE, i);
            if (storageSlot !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
                const value = ethers.BigNumber.from(storageSlot);
                console.log(`  Slot ${i}: ${value.toString()}`);

                // Check if it could be a block number (in reasonable range)
                if (value.gt(190000000) && value.lt(200000000)) {
                    console.log(`    -> Likely block number: ${value.toString()}`);
                }
                // Check if it could be a timestamp
                else if (value.gt(1700000000) && value.lt(2000000000)) {
                    console.log(`    -> Likely timestamp: ${value.toString()} (${new Date(value.toNumber() * 1000).toISOString()})`);
                }
            }
        } catch (e) {
            console.log(`  Error reading slot ${i}:`, e.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });