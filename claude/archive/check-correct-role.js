const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C"; // From deployment
    
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );
    
    const hasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
    
    console.log("=== ORDER_KEEPER Role Check ===\n");
    console.log("Your address:", signer.address);
    console.log("RoleStore:", ROLE_STORE);
    console.log("Has ORDER_KEEPER role:", hasRole ? "✅ YES" : "❌ NO");
    
    if (!hasRole) {
        console.log("\n❌ THIS IS THE PROBLEM!");
        console.log("You don't have ORDER_KEEPER role");
        console.log("This is why executeDeposit fails immediately");
        console.log("\nThe transaction reverts at the onlyOrderKeeper modifier");
        console.log("This explains:");
        console.log("- Low gas usage (~300k)");
        console.log("- No events emitted");  
        console.log("- Simulation works (bypasses modifier)");
    }
}

main().catch(console.error);
