const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== Deploying mUSDTARS Stub Token ===\n");
    console.log("Deployer:", deployer.address);

    // Get balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.utils.formatEther(balance));

    // Deploy mUSDTARS as a minimal ERC20 stub
    // This is just an index token - no actual supply needed
    console.log("\n📍 Deploying mUSDTARS (USDT/ARS Exchange Rate Index Token)...");

    const Token = await ethers.getContractFactory("MintableToken");
    const musdtars = await Token.deploy("mUSDTARS", "mUSDTARS", 18); // Using 18 decimals for precision

    await musdtars.deployed();

    console.log("✅ mUSDTARS deployed to:", musdtars.address);

    // Important: We do NOT mint any tokens
    // This is purely an index token for price tracking
    console.log("\n📝 Token Configuration:");
    console.log("  Name: mUSDTARS");
    console.log("  Symbol: mUSDTARS");
    console.log("  Decimals: 18");
    console.log("  Total Supply: 0 (stub token - no minting needed)");
    console.log("  Purpose: Index token to track USDT/ARS exchange rate");

    // Save deployment info
    const deploymentInfo = {
        network: "arbitrumSepolia",
        token: "mUSDTARS",
        address: musdtars.address,
        decimals: 18,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        txHash: musdtars.deployTransaction.hash,
        purpose: "Index token for USDT/ARS exchange rate (stub - no supply)"
    };

    // Save to file
    const filename = "musdtars-deployment.json";
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to: ${filename}`);

    // Also save just the address for easy access
    fs.writeFileSync("musdtars-address.txt", musdtars.address);
    console.log(`📄 Address saved to: musdtars-address.txt`);

    console.log("\n🎯 Next Steps:");
    console.log("1. Configure oracle provider for mUSDTARS");
    console.log("2. Set oracle price for mUSDTARS (set to current USDT/ARS rate, e.g., 1050 ARS per USDT)");
    console.log("3. Add mUSDTARS to config/tokens.ts");
    console.log("4. Add USDTARS market to config/markets.ts with mUSD as long/short collateral");
    console.log("5. Create and execute first deposit to initialize the market");

    console.log("\n📊 Arbiscan:");
    console.log(`https://sepolia.arbiscan.io/address/${musdtars.address}`);
    console.log(`https://sepolia.arbiscan.io/tx/${musdtars.deployTransaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
