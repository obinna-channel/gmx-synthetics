const { ethers } = require("hardhat");

async function main() {
    const oracle = await ethers.getContractAt("Oracle", "0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C");

    // Read the oracleStore public variable
    const oracleStoreSlot = 3; // Based on contract storage layout
    const storageValue = await ethers.provider.getStorageAt(oracle.address, oracleStoreSlot);
    console.log("OracleStore address from storage:", storageValue);

    // Clean it up to get the address
    const oracleStoreAddress = "0x" + storageValue.slice(-40);
    console.log("Cleaned OracleStore address:", oracleStoreAddress);
}

main().catch(console.error);