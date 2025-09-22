const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Granting MARKET_KEEPER Role ===\n");
    console.log("Your address:", signer.address);
    
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    // Calculate role hash using the CORRECT method
    const MARKET_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET_KEEPER"])
    );
    
    console.log("MARKET_KEEPER hash:", MARKET_KEEPER);
    
    // Grant MARKET_KEEPER role to your address
    console.log("\nGranting MARKET_KEEPER role to your address...");
    const tx = await roleStore.grantRole(signer.address, MARKET_KEEPER);
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
    // Verify the role was granted
    const hasMarketKeeper = await roleStore.hasRole(signer.address, MARKET_KEEPER);
    if (hasMarketKeeper) {
        console.log("\n✅ SUCCESS! You now have MARKET_KEEPER role!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error.message);
        process.exit(1);
    });
