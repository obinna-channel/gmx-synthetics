const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    const ROLE_STORE = "0xC891dc8306e97B1EbdDF021321F0f9541d22dA1f";
    
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);
    
    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );
    
    const hasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
    console.log("Your address:", signer.address);
    console.log("Has ORDER_KEEPER role:", hasRole ? "✅ YES" : "❌ NO");
    
    if (!hasRole) {
        console.log("\n⚠️ This is why execution fails immediately!");
        console.log("The onlyOrderKeeper modifier rejects the transaction");
    }
}

main().catch(console.error);
