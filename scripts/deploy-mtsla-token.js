const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== Deploying mTSLA Stub Token ===\n");
    console.log("Deployer:", deployer.address);

    // Get balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.utils.formatEther(balance));

    // Deploy mTSLA as a minimal ERC20 stub
    // This is just an index token - no actual supply needed
    console.log("\n📍 Deploying mTSLA (TSLA/USD Index Token)...");

    const Token = await ethers.getContractFactory("MintableToken");
    const mtsla = await Token.deploy("mTSLA", "mTSLA", 18); // Using 18 decimals for precision

    await mtsla.deployed();

    console.log("✅ mTSLA deployed to:", mtsla.address);

    // Important: We do NOT mint any tokens
    // This is purely an index token for price tracking
    console.log("\n📝 Token Configuration:");
    console.log("  Name: mTSLA");
    console.log("  Symbol: mTSLA");
    console.log("  Decimals: 18");
    console.log("  Total Supply: 0 (stub token - no minting needed)");
    console.log("  Purpose: Index token to track TSLA/USD stock price");

    // Save deployment info
    const deploymentInfo = {
        network: "arbitrumSepolia",
        token: "mTSLA",
        address: mtsla.address,
        decimals: 18,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        txHash: mtsla.deployTransaction.hash,
        purpose: "Index token for TSLA/USD stock price (stub - no supply)"
    };

    // Save to file
    const filename = "mtsla-deployment.json";
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to: ${filename}`);

    // Also save just the address for easy access
    fs.writeFileSync("mtsla-address.txt", mtsla.address);
    console.log(`📄 Address saved to: mtsla-address.txt`);

    console.log("\n🎯 Next Steps:");
    console.log("1. Configure oracle price for mTSLA (set to current TSLA stock price, e.g., $250)");
    console.log("2. Add mTSLA to config/tokens.ts");
    console.log("3. Add TSLA/USD market to config/markets.ts with USDT as long/short collateral");
    console.log("4. Create and execute first deposit to initialize the market");

    console.log("\n📊 Arbiscan:");
    console.log(`https://sepolia.arbiscan.io/address/${mtsla.address}`);
    console.log(`https://sepolia.arbiscan.io/tx/${mtsla.deployTransaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
