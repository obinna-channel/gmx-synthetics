const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n=== Deploying Test USDT Token ===\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    // Deploy a simple ERC20 token to act as USDT
    // You can use any standard ERC20 implementation
    // For testing, we'll deploy a basic mintable token
    
    console.log("Deploying Test USDT...");
    
    // Using a simple ERC20 contract
    // You might need to create TestUSDT.sol or use an existing ERC20 implementation
    const TestUSDT = await ethers.getContractFactory("TestUSDT");
    
    const usdt = await TestUSDT.deploy(
        "Test USDT",           // name
        "USDT",               // symbol
        6,                    // decimals (USDT uses 6)
        ethers.utils.parseUnits("1000000", 6)  // initial supply: 1M USDT
    );
    
    await usdt.deployed();
    
    const usdtAddress = usdt.address;
    console.log("✅ Test USDT deployed to:", usdtAddress);
    
    // Mint some USDT to your deployer for testing
    console.log("Minting 100,000 USDT to deployer for testing...");
    const mintTx = await usdt.mint(deployer.address, ethers.utils.parseUnits("100000", 6));
    await mintTx.wait();
    
    // Save deployment
    const deploymentPath = path.join(__dirname, "../../deployments/marks/arbitrumSepolia/USDT.json");
    const deploymentData = {
        address: usdtAddress,
        abi: TestUSDT.interface.format('json'),
        metadata: {
            name: "Test USDT",
            symbol: "USDT",
            decimals: 6
        }
    };
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
    
    console.log("\n=== Test USDT Deployment Complete ===");
    console.log("Address:", usdtAddress);
    console.log("Initial supply: 1,000,000 USDT");
    console.log("Deployer balance: 100,000 USDT");
    console.log("\nNext steps:");
    console.log("1. Create the USDTNGN market using MarketFactory");
    console.log("2. Configure DataStore parameters");
    
    return usdtAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });