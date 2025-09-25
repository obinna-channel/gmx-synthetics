const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking ORDER_KEEPER Role ===\n");

    const [signer] = await ethers.getSigners();
    const ROLE_STORE = "0xC14707456D3e119B79fFdb1FeE711BcD0724A3A1";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
    );

    const hasRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);

    console.log("Signer:", signer.address);
    console.log("Has ORDER_KEEPER role:", hasRole);

    if (!hasRole) {
        console.log("\n❌ You don't have ORDER_KEEPER role");
        console.log("This might be why cancellation is failing");
        console.log("Only ORDER_KEEPERs can cancel deposits after they're created");
    } else {
        console.log("\n✅ You have ORDER_KEEPER role");
    }
}

main().catch(console.error);