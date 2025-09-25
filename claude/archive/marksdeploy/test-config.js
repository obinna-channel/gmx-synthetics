require('dotenv').config();

console.log("Testing configuration...");
console.log("RPC URL exists:", !!process.env.ARBITRUM_SEPOLIA_RPC_URL);
console.log("Private Key exists:", !!process.env.DEPLOYER_PRIVATE_KEY);
console.log("Private Key length:", process.env.DEPLOYER_PRIVATE_KEY ? process.env.DEPLOYER_PRIVATE_KEY.length : 0);

// Don't log the actual values for security
if (process.env.DEPLOYER_PRIVATE_KEY) {
    const pk = process.env.DEPLOYER_PRIVATE_KEY;
    console.log("Private Key starts with 0x:", pk.startsWith("0x"));
    console.log("Expected length (64 chars + 0x = 66):", pk.length === 66 || pk.length === 64);
}