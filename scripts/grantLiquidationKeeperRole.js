const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\n📝 Granting LIQUIDATION_KEEPER role...`);
  console.log(`   Using account: ${deployer.address}\n`);

  // Get deployed contract addresses (from claude/deployments/marks-arbitrumSepolia-deployments.md)
  const RoleStore = await hre.ethers.getContractAt(
    "RoleStore",
    "0x4943c063691259B677f3D7BC808C9C3090321EbB"
  );

  // Keeper account (using deployer address)
  const keeperAddress = deployer.address;
  console.log(`   Keeper address: ${keeperAddress}`);

  // LIQUIDATION_KEEPER role hash
  const LIQUIDATION_KEEPER = hre.ethers.utils.keccak256(
    hre.ethers.utils.defaultAbiCoder.encode(["string"], ["LIQUIDATION_KEEPER"])
  );

  console.log(`   Role hash: ${LIQUIDATION_KEEPER}`);

  // Check if role is already granted
  const hasRole = await RoleStore.hasRole(keeperAddress, LIQUIDATION_KEEPER);

  if (hasRole) {
    console.log(`   ✅ Keeper already has LIQUIDATION_KEEPER role`);
  } else {
    console.log(`   ⏳ Granting LIQUIDATION_KEEPER role...`);
    const tx = await RoleStore.grantRole(keeperAddress, LIQUIDATION_KEEPER);
    await tx.wait();
    console.log(`   ✅ LIQUIDATION_KEEPER role granted!`);
    console.log(`   TX: ${tx.hash}`);
  }

  // Verify
  const hasRoleAfter = await RoleStore.hasRole(keeperAddress, LIQUIDATION_KEEPER);
  console.log(`\n✅ Verification: Keeper has role = ${hasRoleAfter}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
