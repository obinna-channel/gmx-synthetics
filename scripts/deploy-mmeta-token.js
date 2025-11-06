const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== Deploying mMETA Stub Token ===\n");
    console.log("Deployer:", deployer.address);

    // Get balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.utils.formatEther(balance));

    // Deploy mMETA as a minimal ERC20 stub
    // This is just an index token - no actual supply needed
    console.log("\n📍 Deploying mMETA (META/USD Index Token)...");

    const Token = await ethers.getContractFactory("MintableToken");
    const mmeta = await Token.deploy("mMETA", "mMETA", 18); // Using 18 decimals for precision

    await mmeta.deployed();

    console.log("✅ mMETA deployed to:", mmeta.address);

    // Important: We do NOT mint any tokens
    // This is purely an index token for price tracking
    console.log("\n📝 Token Configuration:");
    console.log("  Name: mMETA");
    console.log("  Symbol: mMETA");
    console.log("  Decimals: 18");
    console.log("  Total Supply: 0 (stub token - no minting needed)");
    console.log("  Purpose: Index token to track META/USD stock price");

    // Save deployment info
    const deploymentInfo = {
        network: "arbitrumSepolia",
        token: "mMETA",
        address: mmeta.address,
        decimals: 18,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        txHash: mmeta.deployTransaction.hash,
        purpose: "Index token for META/USD stock price (stub - no supply)"
    };

    // Save to file
    const filename = "mmeta-deployment.json";
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to: ${filename}`);

    // Also save just the address for easy access
    fs.writeFileSync("mmeta-address.txt", mmeta.address);
    console.log(`📄 Address saved to: mmeta-address.txt`);

    console.log("\n🎯 Next Steps:");
    console.log("1. Configure oracle price for mMETA (set to current META stock price, e.g., $600)");
    console.log("2. Add mMETA to config/tokens.ts");
    console.log("3. Add META/USD market to config/markets.ts with mUSD as long/short collateral");
    console.log("4. Create and execute first deposit to initialize the market");

    console.log("\n📊 Arbiscan:");
    console.log(`https://sepolia.arbiscan.io/address/${mmeta.address}`);
    console.log(`https://sepolia.arbiscan.io/tx/${mmeta.deployTransaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
