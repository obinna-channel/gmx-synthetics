const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing DataStore write with fixed CONTROLLER role");
    console.log("Deployer:", deployer.address);
    
    const dataStore = await ethers.getContractAt("DataStore", "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da");
    
    // Try to write a test value
    const testKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TEST_KEY_FIXED"));
    const testValue = 999;
    
    console.log("\nAttempting to write to DataStore...");
    console.log("Key:", testKey);
    console.log("Value:", testValue);
    
    try {
        const tx = await dataStore.setUint(testKey, testValue);
        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✓ Transaction confirmed in block:", receipt.blockNumber);
        
        // Read back the value
        const storedValue = await dataStore.getUint(testKey);
        console.log("\n✓ SUCCESS! DataStore write worked!");
        console.log("Value written:", testValue);
        console.log("Value read back:", storedValue.toString());
        console.log("Match:", storedValue.toString() === testValue.toString());
    } catch (error) {
        console.log("\n✗ FAILED:", error.reason || error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
