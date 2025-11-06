const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying mNVDA token...");

    const Token = await ethers.getContractFactory("MintableToken");
    const mnvda = await Token.deploy("mNVDA", "mNVDA", 18);
    await mnvda.deployed();

    console.log("mNVDA deployed to:", mnvda.address);
    console.log("\nToken Details:");
    console.log("  Name:", await mnvda.name());
    console.log("  Symbol:", await mnvda.symbol());
    console.log("  Decimals:", await mnvda.decimals());
    console.log("\n✅ Deployment complete!");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
