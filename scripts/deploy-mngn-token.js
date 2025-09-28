const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("=== Deploying mNGN Token ===\n");
    console.log("Deployer address:", deployer.address);

    // Get deployer balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer ETH balance:", ethers.utils.formatEther(balance));

    // Deploy MintableToken contract with mNGN parameters
    // Same as sNGN: 18 decimals for compatibility with GMX
    console.log("\n📍 Deploying mNGN (Mock Nigerian Naira)...");

    const MintableToken = await ethers.getContractFactory("MintableToken");

    const mNGN = await MintableToken.deploy(
        "Mock Nigerian Naira",  // name
        "mNGN",                 // symbol
        18                      // decimals (same as sNGN for GMX compatibility)
    );

    await mNGN.deployed();

    console.log("✅ mNGN deployed to:", mNGN.address);

    // Mint initial supply to deployer
    // 2 billion mNGN for testing
    const initialSupply = ethers.utils.parseUnits("2000000000", 18); // 2 billion mNGN
    console.log("\n📍 Minting initial supply...");
    console.log("  Amount: 2,000,000,000 mNGN");

    const mintTx = await mNGN.mint(deployer.address, initialSupply);
    await mintTx.wait();
    console.log("✅ Minted to deployer");

    // Verify the deployment
    const deployerBalance = await mNGN.balanceOf(deployer.address);
    const totalSupply = await mNGN.totalSupply();
    const decimals = await mNGN.decimals();
    const symbol = await mNGN.symbol();
    const name = await mNGN.name();

    console.log("\n=== Deployment Summary ===");
    console.log("Token Name:", name);
    console.log("Token Symbol:", symbol);
    console.log("Token Decimals:", decimals);
    console.log("Token Address:", mNGN.address);
    console.log("Total Supply:", ethers.utils.formatUnits(totalSupply, 18), "mNGN");
    console.log("Deployer Balance:", ethers.utils.formatUnits(deployerBalance, 18), "mNGN");

    // Save deployment info to file for future reference
    const fs = require("fs");
    const deploymentInfo = {
        name: name,
        symbol: symbol,
        decimals: decimals,
        address: mNGN.address,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        initialSupply: ethers.utils.formatUnits(initialSupply, 18),
        network: "Arbitrum Sepolia"
    };

    fs.writeFileSync(
        "mngn-deployment.json",
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n📝 Deployment info saved to: mngn-deployment.json");

    console.log("\n=== Next Steps ===");
    console.log("1. Configure oracle prices for mNGN (1 mNGN = 1 NGN)");
    console.log("2. Create new market with mNGN token configuration:");
    console.log("   - Option A: mNGN index, USDT long, mNGN short");
    console.log("   - Option B: USDT index, USDT long, mNGN short");
    console.log("3. Set up MockOracleProvider for mNGN");
    console.log("\nmNGN Token Address:", mNGN.address);

    return mNGN.address;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });