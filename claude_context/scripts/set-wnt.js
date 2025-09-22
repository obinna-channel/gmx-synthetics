const { ethers } = require("hardhat");

async function main() {
    console.log("=== SETTING WNT ADDRESS ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    
    // On Arbitrum Sepolia, WETH address
    const WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";  // Arbitrum Sepolia WETH
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // WNT key is just the hash of "WNT"
    const wntKey = ethers.utils.id("WNT");
    
    console.log("Setting WNT to WETH address:", WETH);
    console.log("Key:", wntKey);
    
    try {
        const tx = await dataStore.setAddress(wntKey, WETH);
        await tx.wait();
        console.log("✓ WNT set successfully!");
        
        // Verify
        const storedWnt = await dataStore.getAddress(wntKey);
        console.log("Verified WNT:", storedWnt);
        
    } catch (e) {
        console.log("Error setting WNT:", e.message);
    }
}

main().catch(console.error);
