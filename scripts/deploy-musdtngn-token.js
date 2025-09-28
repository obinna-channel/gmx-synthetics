const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== Deploying mUSDTNGN Stub Token ===\n");
    console.log("Deployer:", deployer.address);

    // Get balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("ETH Balance:", ethers.utils.formatEther(balance));

    // Deploy mUSDTNGN as a minimal ERC20 stub
    // This is just an index token - no actual supply needed
    console.log("\n📍 Deploying mUSDTNGN (USDT/NGN Index Token)...");

    const Token = await ethers.getContractFactory("MintableToken");
    const musdtngn = await Token.deploy("mUSDTNGN", "mUSDTNGN", 18); // Using 18 decimals for precision

    await musdtngn.deployed();

    console.log("✅ mUSDTNGN deployed to:", musdtngn.address);

    // Important: We do NOT mint any tokens
    // This is purely an index token for price tracking
    console.log("\n📝 Token Configuration:");
    console.log("  Name: mUSDTNGN");
    console.log("  Symbol: mUSDTNGN");
    console.log("  Decimals: 18");
    console.log("  Total Supply: 0 (stub token - no minting needed)");
    console.log("  Purpose: Index token to track USDT/NGN exchange rate");

    // Save deployment info
    const deploymentInfo = {
        network: "arbitrumSepolia",
        token: "mUSDTNGN",
        address: musdtngn.address,
        decimals: 18,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        txHash: musdtngn.deployTransaction.hash,
        purpose: "Index token for USDT/NGN exchange rate (stub - no supply)"
    };

    // Save to file
    const filename = "musdtngn-deployment.json";
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📄 Deployment info saved to: ${filename}`);

    // Also save just the address for easy access
    fs.writeFileSync("musdtngn-address.txt", musdtngn.address);
    console.log(`📄 Address saved to: musdtngn-address.txt`);

    console.log("\n🎯 Next Steps:");
    console.log("1. Configure oracle price for mUSDTNGN (set to current USDT/NGN rate, e.g., 1500)");
    console.log("2. Configure mUSD price to 1");
    console.log("3. Configure mNGN price to 1/rate (e.g., 0.000667 for rate of 1500)");
    console.log("4. Create market with mUSDTNGN as index, mUSD as long, mNGN as short");

    console.log("\n📊 Arbiscan:");
    console.log(`https://sepolia.arbiscan.io/address/${musdtngn.address}`);
    console.log(`https://sepolia.arbiscan.io/tx/${musdtngn.deployTransaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });