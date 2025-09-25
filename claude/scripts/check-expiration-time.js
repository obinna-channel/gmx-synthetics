const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Expiration Settings ===\n");
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check REQUEST_EXPIRATION_TIME
    const REQUEST_EXPIRATION_TIME = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["REQUEST_EXPIRATION_TIME"])
    );
    
    const expirationTime = await dataStore.getUint(REQUEST_EXPIRATION_TIME);
    console.log("REQUEST_EXPIRATION_TIME:", expirationTime.toString(), "seconds");
    
    if (expirationTime.gt(0)) {
        console.log("  = ", expirationTime.div(60).toString(), "minutes");
        console.log("  = ", expirationTime.div(3600).toString(), "hours");
    } else {
        console.log("  ⚠️  Not set (0) - might use a default or no expiration");
    }
    
    // Get current block time
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("\nCurrent block:", currentBlock.number);
    console.log("Current timestamp:", currentBlock.timestamp);
    console.log("Current time:", new Date(currentBlock.timestamp * 1000).toISOString());
    
    // Our deposit was created much earlier
    // From the error, deposit.updatedAtTime = 0x68d319a7 = 1758665127
    const depositCreatedAt = 1758665127;
    console.log("\nDeposit created at:", depositCreatedAt);
    console.log("Deposit created time:", new Date(depositCreatedAt * 1000).toISOString());
    
    const timeSinceCreation = currentBlock.timestamp - depositCreatedAt;
    console.log("\nTime since deposit creation:", timeSinceCreation, "seconds");
    console.log("  = ", Math.floor(timeSinceCreation / 60), "minutes");
    console.log("  = ", Math.floor(timeSinceCreation / 3600), "hours");
    
    if (expirationTime.gt(0) && timeSinceCreation > expirationTime.toNumber()) {
        console.log("\n❌ DEPOSIT HAS EXPIRED!");
        console.log("The deposit is", timeSinceCreation - expirationTime.toNumber(), "seconds past expiration");
    } else if (expirationTime.gt(0)) {
        console.log("\n✅ Deposit is still within expiration window");
        console.log("Time remaining:", expirationTime.toNumber() - timeSinceCreation, "seconds");
    }
}

main().catch(console.error);