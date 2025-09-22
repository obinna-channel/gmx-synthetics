const { ethers } = require("hardhat");

async function main() {
    console.log("=== SETTING MAX DEPOSIT AMOUNT ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const [deployer] = await ethers.getSigners();
    
    // Set max deposit to 10 million USDT
    const maxDepositAmount = ethers.utils.parseUnits("10000000", 6); // 10M USDT
    
    const maxDepositKey = ethers.utils.keccak256(
        ethers.utils.solidityPack(["string", "address", "address"], ["MAX_DEPOSIT_AMOUNT", MARKET, USDT])
    );
    
    console.log("Setting max deposit amount to 10,000,000 USDT...");
    
    try {
        const tx = await dataStore.setUint(maxDepositKey, maxDepositAmount);
        await tx.wait();
        console.log("✅ Max deposit amount set!");
        
        // Verify
        const newMax = await dataStore.getUint(maxDepositKey);
        console.log("Verified max deposit:", ethers.utils.formatUnits(newMax, 6), "USDT");
        
    } catch (error) {
        console.log("❌ Error:", error.reason || error.message);
        if (error.message.includes("Unauthorized")) {
            console.log("Need CONTROLLER role to set this value");
        }
    }
}

main().catch(console.error);
