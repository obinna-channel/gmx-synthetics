const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n=== Deploying mUSD Token ===\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Deploy a simple ERC20 token to act as mUSD
    // Using the same configuration as test USDT

    console.log("Deploying mUSD...");

    // Using the same TestUSDT contract but for mUSD
    // The contract factory name is TestUSDT but we're deploying it as mUSD
    const TestUSDT = await ethers.getContractFactory("TestUSDT");

    const musd = await TestUSDT.deploy(
        "Marks USD",          // name
        "mUSD",               // symbol
        6,                    // decimals (same as USDT uses 6)
        ethers.utils.parseUnits("10000000", 6)  // initial supply: 10M mUSD (to have enough)
    );

    await musd.deployed();

    const musdAddress = musd.address;
    console.log("✅ mUSD deployed to:", musdAddress);

    // Mint 1 million mUSD to your deployer for testing
    console.log("Minting 1,000,000 mUSD to deployer for testing...");
    const mintTx = await musd.mint(deployer.address, ethers.utils.parseUnits("1000000", 6));
    await mintTx.wait();

    // Check balance
    const balance = await musd.balanceOf(deployer.address);
    console.log("Deployer mUSD balance:", ethers.utils.formatUnits(balance, 6));

    // Save deployment
    const deploymentPath = path.join(__dirname, "../deployments/marks/arbitrumSepolia/mUSD.json");
    const deploymentData = {
        address: musdAddress,
        abi: TestUSDT.interface.format('json'),
        metadata: {
            name: "Marks USD",
            symbol: "mUSD",
            decimals: 6,
            deployedAt: new Date().toISOString(),
            network: "arbitrumSepolia"
        }
    };

    // Create directory if it doesn't exist
    const dir = path.dirname(deploymentPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

    // Also save a simple text file with just the address for easy reference
    fs.writeFileSync("musd-address.txt", musdAddress);

    console.log("\n=== mUSD Deployment Complete ===");
    console.log("Address:", musdAddress);
    console.log("Name: Marks USD");
    console.log("Symbol: mUSD");
    console.log("Decimals: 6");
    console.log("Total supply: 10,000,000 mUSD");
    console.log("Deployer balance: 1,000,000 mUSD");
    console.log("\nDeployment saved to:", deploymentPath);
    console.log("Address saved to: musd-address.txt");
    console.log("\nNext steps:");
    console.log("1. Create markets with mUSD (e.g., mUSD/mUSD/mNGN)");
    console.log("2. Configure oracle prices for mUSD");
    console.log("3. Test with smaller initial liquidity amounts");

    return musdAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });