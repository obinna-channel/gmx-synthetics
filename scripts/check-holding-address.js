const { ethers } = require("hardhat");

async function main() {
    const dataStoreAddress = ethers.utils.getAddress("0xD4e917e95BFBcdb12a50E842C4fE80Ba81FD1e89");
    const dataStore = await ethers.getContractAt("DataStore", dataStoreAddress);
    
    console.log("=== Checking DataStore Configuration ===\n");
    
    // Check holding address
    const holdingAddressKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("HOLDING_ADDRESS"));
    console.log("Holding Address Key:", holdingAddressKey);
    
    try {
        const holdingAddress = await dataStore.getAddress(holdingAddressKey);
        console.log("Holding Address:", holdingAddress);
        
        if (holdingAddress === ethers.constants.AddressZero) {
            console.log("\n❌ HOLDING ADDRESS IS NOT SET!");
            console.log("This is the root cause of your error.");
        } else {
            console.log("\n✓ Holding address is configured:", holdingAddress);
        }
    } catch (e) {
        console.log("Error reading holding address:", e.message);
    }
    
    // Check if this is a new issue or has always been there
    console.log("\n=== Why This Didn't Affect Other Orders ===");
    console.log("The holding address is only used as a FALLBACK when:");
    console.log("1. The primary token transfer to the receiver FAILS");
    console.log("2. Reasons for transfer failure:");
    console.log("   - Receiver is a contract with no receive function");
    console.log("   - Receiver's receive function reverts");
    console.log("   - Transfer exceeds the gas limit");
    console.log("   - Token has transfer restrictions/blacklist");
    console.log("\nYour other orders probably succeeded on the FIRST transfer attempt.");
    console.log("This order's transfer failed, triggering the holding address fallback.");
}

main().catch(console.error);
