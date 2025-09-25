const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();
    const ROLE_STORE = "0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C";
    const roleStore = await ethers.getContractAt("RoleStore", ROLE_STORE);

    const CONTROLLER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );

    const hasRole = await roleStore.hasRole(signer.address, CONTROLLER);
    console.log("Account:", signer.address);
    console.log("Has CONTROLLER role:", hasRole);
}

main().catch(console.error);