const { ethers } = require("hardhat");

async function main() {
  const [signer] = await ethers.getSigners();
  const mockProvider = await ethers.getContractAt("contracts/oracle/MockOracleProvider.sol:MockOracleProvider", "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5");
  
  const owner = await mockProvider.owner();
  const isUpdater = await mockProvider.isPriceUpdater(signer.address);
  
  console.log("\nYour address:", signer.address);
  console.log("Contract owner:", owner);
  console.log("Are you the owner?", owner.toLowerCase() === signer.address.toLowerCase());
  console.log("Are you a price updater?", isUpdater);
  
  if (!isUpdater && owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log("\n❌ You are NOT authorized! This is why liquidations are failing!");
    console.log("\nThe Python keeper probably runs from the owner account or has been granted access.");
  } else {
    console.log("\n✅ You ARE authorized");
  }
}

main().catch(console.error);
