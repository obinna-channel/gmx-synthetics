const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== Deploying mCOP Stub Token ===\n");
    console.log("Deployer:", deployer.address);

    // Get balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.utils.formatEther(balance));

    // Deploy mCOP as a minimal ERC20 stub
    // This is just an index token - no actual supply needed
    console.log("\n📍 Deploying mCOP (USDT/COP Exchange Rate Index Token)...");

    const Token = await ethers.getContractFactory("MintableToken");
    const mcop = await Token.deploy("mCOP", "mCOP", 18); // Using 18 decimals for precision

    await mcop.deployed();

    console.log("✅ mCOP deployed to:", mcop.address);

    // Important: We do NOT mint any tokens
    // This is purely an index token for price tracking
    console.log("\n📝 Token Configuration:");
    console.log("  Name: mCOP");
    console.log("  Symbol: mCOP");
    console.log("  Decimals: 18");
    console.log("  Total Supply: 0 (stub token - no minting needed)");
    console.log("  Purpose: Index token to track USDT/COP exchange rate");

    // Save deployment info
    const deploymentInfo = {
        network: "arbitrumSepolia",
        token: "mCOP",
        address: mcop.address,
        decimals: 18,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        txHash: mcop.deployTransaction.hash,
        purpose: "Index token for USDT/COP exchange rate (stub - no supply)"
    };

    // Save to file
    const filename = "mcop-deployment.json";
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to: ${filename}`);

    // Also save just the address for easy access
    fs.writeFileSync("mcop-address.txt", mcop.address);
    console.log(`📄 Address saved to: mcop-address.txt`);

    console.log("\n🎯 Next Steps:");
    console.log("1. Configure oracle provider for mCOP");
    console.log("2. Set oracle price for mCOP (set to current USDT/COP rate, e.g., 4,400 COP per USDT)");
    console.log("3. Add mCOP to config/tokens.ts");
    console.log("4. Add COP market to config/markets.ts with mUSD as long/short collateral");
    console.log("5. Create and execute first deposit to initialize the market");

    console.log("\n📊 Arbiscan:");
    console.log(`https://sepolia.arbiscan.io/address/${mcop.address}`);
    console.log(`https://sepolia.arbiscan.io/tx/${mcop.deployTransaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
