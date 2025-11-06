const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== Deploying mAAPL Stub Token ===\n");
    console.log("Deployer:", deployer.address);

    // Get balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.utils.formatEther(balance));

    // Deploy mAAPL as a minimal ERC20 stub
    // This is just an index token - no actual supply needed
    console.log("\n📍 Deploying mAAPL (AAPL/USD Index Token)...");

    const Token = await ethers.getContractFactory("MintableToken");
    const maapl = await Token.deploy("mAAPL", "mAAPL", 18); // Using 18 decimals for precision

    await maapl.deployed();

    console.log("✅ mAAPL deployed to:", maapl.address);

    // Important: We do NOT mint any tokens
    // This is purely an index token for price tracking
    console.log("\n📝 Token Configuration:");
    console.log("  Name: mAAPL");
    console.log("  Symbol: mAAPL");
    console.log("  Decimals: 18");
    console.log("  Total Supply: 0 (stub token - no minting needed)");
    console.log("  Purpose: Index token to track AAPL/USD stock price");

    // Save deployment info
    const deploymentInfo = {
        network: "arbitrumSepolia",
        token: "mAAPL",
        address: maapl.address,
        decimals: 18,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        txHash: maapl.deployTransaction.hash,
        purpose: "Index token for AAPL/USD stock price (stub - no supply)"
    };

    // Save to file
    const filename = "maapl-deployment.json";
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to: ${filename}`);

    // Also save just the address for easy access
    fs.writeFileSync("maapl-address.txt", maapl.address);
    console.log(`📄 Address saved to: maapl-address.txt`);

    console.log("\n🎯 Next Steps:");
    console.log("1. Configure oracle price for mAAPL (set to current AAPL stock price)");
    console.log("2. Add mAAPL to config/tokens.ts");
    console.log("3. Add AAPL/USD market to config/markets.ts with mUSD as long/short collateral");
    console.log("4. Create and execute first deposit to initialize the market");

    console.log("\n📊 Arbiscan:");
    console.log(`https://sepolia.arbiscan.io/address/${maapl.address}`);
    console.log(`https://sepolia.arbiscan.io/tx/${maapl.deployTransaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
