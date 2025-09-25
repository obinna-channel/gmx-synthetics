const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Testing Simple ETH Transfer ===\n");

    const balance = await signer.getBalance();
    console.log("Balance:", ethers.utils.formatEther(balance), "ETH");

    // Try a simple ETH transfer to self
    try {
        const tx = await signer.sendTransaction({
            to: signer.address,
            value: ethers.utils.parseEther("0.0001")
        });
        console.log("TX sent:", tx.hash);
        await tx.wait();
        console.log("✅ Simple transfer works");
    } catch (e) {
        console.log("❌ Simple transfer failed:", e.message);
    }

    // Check nonce
    const nonce = await signer.getTransactionCount();
    console.log("\nCurrent nonce:", nonce);
}

main().catch(console.error);