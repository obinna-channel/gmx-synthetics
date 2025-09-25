const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    const ROLE_STORE = ethers.utils.getAddress("0xc891dc8306e97b1ebddf021321f0f9541d22da1f");
    
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );
    
    const hasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
    console.log("Your address:", signer.address);
    console.log("Has ORDER_KEEPER role:", hasRole ? "✅ YES" : "❌ NO");
    
    if (!hasRole) {
        console.log("\n❌ THIS IS THE PROBLEM!");
        console.log("Execution fails because you don't have ORDER_KEEPER role");
        console.log("The transaction reverts at the onlyOrderKeeper modifier");
        console.log("\nThis explains:");
        console.log("- Why gas used is only ~300k (fails early)");
        console.log("- Why no events are emitted");
        console.log("- Why simulation works (callStatic bypasses modifier)");
    } else {
        console.log("\n✅ You have the role, so this isn't the issue");
    }
}

main().catch(console.error);
