const { ethers } = require("hardhat");

async function main() {
    console.log("=== DECODING INSUFFICIENT EXECUTION FEE ERROR ===\n");

    // The error data from our trace
    const errorData = "0x3a78cd7e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002386f26fc10000";

    console.log("Error selector: 0x3a78cd7e (InsufficientExecutionFee)");

    // Decode the parameters
    // Skip the selector (first 4 bytes = 10 chars with 0x)
    const params = errorData.slice(10);

    // First 32 bytes (64 chars) - provided amount
    const providedHex = "0x" + params.slice(0, 64);
    const provided = ethers.BigNumber.from(providedHex);

    // Next 32 bytes - required amount
    const requiredHex = "0x" + params.slice(64, 128);
    const required = ethers.BigNumber.from(requiredHex);

    console.log("Provided execution fee:", ethers.utils.formatEther(provided), "ETH");
    console.log("Required execution fee:", ethers.utils.formatEther(required), "ETH");

    console.log("\n=== ANALYSIS ===");
    console.log("We provided: 0.01 ETH");
    console.log("Detected as: 0 ETH");
    console.log("Required:", ethers.utils.formatEther(required), "ETH");

    console.log("\n❌ THE ISSUE:");
    console.log("The contract is detecting our execution fee as 0!");
    console.log("Even though we sent 0.01 ETH with the transaction.");

    console.log("\n=== POSSIBLE REASONS ===");
    console.log("1. The execution fee isn't being passed correctly to DepositUtils");
    console.log("2. The contract expects WNT (wrapped ETH) not native ETH");
    console.log("3. There's an issue with how the execution fee is calculated");

    // Convert the required amount to see what it expects
    const requiredInGwei = ethers.utils.formatUnits(required, 9);
    console.log("\nRequired amount in Gwei:", requiredInGwei);

    // Check if this matches our calculation
    const gasLimit = 3000000;
    const gasPrice = ethers.utils.parseUnits("0.1", 9); // 0.1 Gwei
    const baseAmount = ethers.utils.parseEther("0.001");

    const calculated = gasPrice.mul(gasLimit).add(baseAmount);
    console.log("Our calculated amount:", ethers.utils.formatEther(calculated), "ETH");

    if (!calculated.eq(required)) {
        console.log("\n⚠️ Required amount doesn't match our calculation!");
        console.log("There's something else in the fee calculation we're missing.");
    }
}