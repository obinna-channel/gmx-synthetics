const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Testing token transfer...\n");

    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const ROUTER = "0xAE75C18248905dB5E1ceE00c4655Feb49BA25252";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    
    const usdt = await ethers.getContractAt("IERC20", USDT);
    
    // Check balance
    const balance = await usdt.balanceOf(signer.address);
    console.log("USDT balance:", ethers.utils.formatUnits(balance, 6));
    
    // Try direct transfer to deposit vault
    console.log("\nTransferring 100 USDT directly to DepositVault...");
    const amount = ethers.utils.parseUnits("100", 6);
    
    try {
        const tx = await usdt.transfer(DEPOSIT_VAULT, amount);
        console.log("Transfer tx:", tx.hash);
        await tx.wait();
        console.log("✅ Transfer successful!");
        
        // Check vault balance
        const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
        console.log("\nDepositVault balance:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");
    } catch (error) {
        console.log("❌ Transfer failed:", error.message);
    }
}

main().catch(console.error);
