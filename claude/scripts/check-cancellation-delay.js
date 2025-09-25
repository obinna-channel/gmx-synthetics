const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Cancellation Delay ===\n");

    const depositKey = "0x12c0b3982ec25d66ac8a28e3ad6d6a8a8b71255c41f53fea57eb94a107913196";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get deposit creation time
    const UPDATED_AT_TIME = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["UPDATED_AT_TIME"]));
    const updatedAtKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, UPDATED_AT_TIME])
    );
    const updatedAt = await dataStore.getUint(updatedAtKey);

    // Get current time
    const block = await ethers.provider.getBlock("latest");
    const currentTime = block.timestamp;

    console.log("Deposit created at:", updatedAt.toString());
    console.log("Current time:", currentTime);
    console.log("Deposit age:", currentTime - updatedAt.toNumber(), "seconds");

    // Check for MIN_CANCELLATION_DELAY
    const MIN_CANCELLATION_DELAY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_CANCELLATION_DELAY"])
    );
    const minDelay = await dataStore.getUint(MIN_CANCELLATION_DELAY);
    console.log("\nMIN_CANCELLATION_DELAY:", minDelay.toString(), "seconds");

    // Check for MIN_CANCELLATION_DELAY_BLOCKS
    const MIN_CANCELLATION_DELAY_BLOCKS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_CANCELLATION_DELAY_BLOCKS"])
    );
    const minDelayBlocks = await dataStore.getUint(MIN_CANCELLATION_DELAY_BLOCKS);
    console.log("MIN_CANCELLATION_DELAY_BLOCKS:", minDelayBlocks.toString());

    // Check current block
    console.log("\nCurrent block:", block.number);

    // Check when it will be cancellable
    if (minDelay.gt(0)) {
        const timeUntilCancellable = updatedAt.add(minDelay).sub(currentTime);
        if (timeUntilCancellable.gt(0)) {
            console.log("\n⏰ Time until cancellable:", timeUntilCancellable.toString(), "seconds");
            console.log("Can cancel at:", new Date((updatedAt.toNumber() + minDelay.toNumber()) * 1000).toISOString());
        } else {
            console.log("\n✅ Deposit should be cancellable now");
        }
    }

    // Also check REQUEST_EXPIRATION_TIME to see if it's still valid
    const REQUEST_EXPIRATION_TIME = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["REQUEST_EXPIRATION_TIME"])
    );
    const expirationTime = await dataStore.getUint(REQUEST_EXPIRATION_TIME);
    console.log("\nREQUEST_EXPIRATION_TIME:", expirationTime.toString(), "seconds");

    if (expirationTime.gt(0)) {
        const timeUntilExpiration = updatedAt.add(expirationTime).sub(currentTime);
        if (timeUntilExpiration.gt(0)) {
            console.log("Time until expiration:", timeUntilExpiration.toString(), "seconds");
        } else {
            console.log("❌ Deposit has expired!");
        }
    }
}

main().catch(console.error);