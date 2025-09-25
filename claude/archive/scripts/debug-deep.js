const { ethers } = require("hardhat");

async function main() {
    console.log("=== DEEP DEBUG - FINDING THE ISSUE ===\n");

    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";
    const MARKET = "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // The error shows address(0) is being checked for authorization
    // This could happen if a contract address is not set properly
    
    // Check critical contract addresses
    console.log("Checking critical contract addresses in DataStore:");
    
    const FEE_RECEIVER = ethers.utils.id("FEE_RECEIVER");
    const feeReceiver = await dataStore.getAddress(FEE_RECEIVER);
    console.log("FEE_RECEIVER:", feeReceiver);
    
    const HOLDING_ADDRESS = ethers.utils.id("HOLDING_ADDRESS");
    const holdingAddress = await dataStore.getAddress(HOLDING_ADDRESS);
    console.log("HOLDING_ADDRESS:", holdingAddress);
    
    // Check if SwapHandler is set (used in deposit flow)
    const SWAP_HANDLER = ethers.utils.id("SWAP_HANDLER");
    const swapHandler = await dataStore.getAddress(SWAP_HANDLER);
    console.log("SWAP_HANDLER:", swapHandler);
    
    // The deposit flow might be trying to call a function on a zero address
    // Let's check DepositHandler's dependencies
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    
    // Get SwapHandler from DepositHandler
    const swapHandlerFromContract = await depositHandler.swapHandler();
    console.log("\nSwapHandler from DepositHandler:", swapHandlerFromContract);
    
    if (swapHandlerFromContract === ethers.constants.AddressZero) {
        console.log("\n❌ FOUND THE ISSUE!");
        console.log("DepositHandler has SwapHandler set to address(0)!");
        console.log("When deposit tries to use SwapHandler, it checks roles on address(0)");
        console.log("This causes the Unauthorized(0x0000..., roleName) error!");
    }
}

main().catch(console.error);
