const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    const roleStore = await ethers.getContractAt("RoleStore", "0x4943c063691259B677f3D7BC808C9C3090321EbB");

    const keeperAddress = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";

    const LIQUIDATION_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["LIQUIDATION_KEEPER"])
    );

    console.log(`Checking LIQUIDATION_KEEPER role for ${keeperAddress}`);
    console.log(`Role hash: ${LIQUIDATION_KEEPER}`);

    const hasRole = await roleStore.hasRole(keeperAddress, LIQUIDATION_KEEPER);

    console.log(`Has LIQUIDATION_KEEPER role: ${hasRole}`);
}

main().catch(console.error);
