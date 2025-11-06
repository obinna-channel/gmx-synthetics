const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== Deploying mPKR Stub Token ===\n");
    console.log("Deployer:", deployer.address);

    // Get balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.utils.formatEther(balance));

    // Deploy mPKR as a minimal ERC20 stub
    // This is just an index token - no actual supply needed
    console.log("\n📍 Deploying mPKR (USDT/PKR Exchange Rate Index Token)...");

    const Token = await ethers.getContractFactory("MintableToken");
    const mpkr = await Token.deploy("mPKR", "mPKR", 18); // Using 18 decimals for precision

    await mpkr.deployed();

    console.log("✅ mPKR deployed to:", mpkr.address);

    // Important: We do NOT mint any tokens
    // This is purely an index token for price tracking
    console.log("\n📝 Token Configuration:");
    console.log("  Name: mPKR");
    console.log("  Symbol: mPKR");
    console.log("  Decimals: 18");
    console.log("  Total Supply: 0 (stub token - no minting needed)");
    console.log("  Purpose: Index token to track USDT/PKR exchange rate");

    // Save deployment info
    const deploymentInfo = {
        network: "arbitrumSepolia",
        token: "mPKR",
        address: mpkr.address,
        decimals: 18,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        txHash: mpkr.deployTransaction.hash,
        purpose: "Index token for USDT/PKR exchange rate (stub - no supply)"
    };

    // Save to file
    const filename = "mpkr-deployment.json";
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to: ${filename}`);

    // Also save just the address for easy access
    fs.writeFileSync("mpkr-address.txt", mpkr.address);
    console.log(`📄 Address saved to: mpkr-address.txt`);

    console.log("\n🎯 Next Steps:");
    console.log("1. Configure oracle provider for mPKR");
    console.log("2. Set oracle price for mPKR (set to current USDT/PKR rate, e.g., 278 PKR per USDT)");
    console.log("3. Add mPKR to config/tokens.ts");
    console.log("4. Add PKR market to config/markets.ts with mUSD as long/short collateral");
    console.log("5. Create and execute first deposit to initialize the market");

    console.log("\n📊 Arbiscan:");
    console.log(`https://sepolia.arbiscan.io/address/${mpkr.address}`);
    console.log(`https://sepolia.arbiscan.io/tx/${mpkr.deployTransaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
