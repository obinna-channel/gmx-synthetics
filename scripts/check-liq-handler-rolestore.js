const { ethers } = require("hardhat");

async function main() {
    const liqHandler = await ethers.getContractAt(
        "LiquidationHandler",
        "0x8bD26BB56452De34d0E041A70d1040CDae2BEd4A"
    );

    const roleStoreAddress = await liqHandler.roleStore();

    console.log(`LiquidationHandler's RoleStore: ${roleStoreAddress}`);
    console.log(`Expected RoleStore: 0x4943c063691259B677f3D7BC808C9C3090321EbB`);
    console.log(`Match: ${roleStoreAddress.toLowerCase() === "0x4943c063691259B677f3D7BC808C9C3090321EbB".toLowerCase()}`);
}

main().catch(console.error);
