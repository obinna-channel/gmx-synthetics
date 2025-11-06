const hre = require("hardhat");
const { ethers } = require("ethers");

// Simple test to understand how fundingExponentFactor works

async function main() {
  console.log("\n=== Testing Funding Exponent Factor ===\n");

  // Test values
  const longOI = ethers.utils.parseUnits("38186", 30);   // $38,186
  const shortOI = ethers.utils.parseUnits("995", 30);     // $995
  const diffUsd = longOI.sub(shortOI);                     // $37,191
  const totalOI = longOI.add(shortOI);                     // $39,181

  console.log("Test Setup:");
  console.log(`Long OI: ${ethers.utils.formatUnits(longOI, 30)} USD`);
  console.log(`Short OI: ${ethers.utils.formatUnits(shortOI, 30)} USD`);
  console.log(`Diff USD: ${ethers.utils.formatUnits(diffUsd, 30)} USD`);
  console.log(`Total OI: ${ethers.utils.formatUnits(totalOI, 30)} USD\n`);

  // Get Precision contract to test applyExponentFactor
  const Precision = await hre.ethers.getContractFactory("Precision");
  const precision = await Precision.deploy();
  await precision.deployed();

  // Test with exponent = 1 (linear)
  console.log("=== EXPONENT = 1 (Linear) ===\n");
  const exponent1 = ethers.utils.parseUnits("1", 30);  // 1.0

  try {
    const diffAfterExp1 = await precision.applyExponentFactor(diffUsd, exponent1);
    console.log(`diffUsdAfterExponent: ${ethers.utils.formatUnits(diffAfterExp1, 30)} USD`);

    const factor1 = await precision.toFactor(diffAfterExp1, totalOI, false);
    console.log(`diffUsdToOpenInterestFactor: ${ethers.utils.formatUnits(factor1, 30)} (${(Number(ethers.utils.formatUnits(factor1, 30)) * 100).toFixed(2)}%)\n`);
  } catch (error) {
    console.log("Error with exponent=1:", error.message);
  }

  // Test with exponent = 2 (quadratic)
  console.log("=== EXPONENT = 2 (Quadratic) ===\n");
  const exponent2 = ethers.utils.parseUnits("2", 30);  // 2.0

  try {
    const diffAfterExp2 = await precision.applyExponentFactor(diffUsd, exponent2);
    console.log(`diffUsdAfterExponent: ${ethers.utils.formatUnits(diffAfterExp2, 30)} USD`);

    const factor2 = await precision.toFactor(diffAfterExp2, totalOI, false);
    console.log(`diffUsdToOpenInterestFactor: ${ethers.utils.formatUnits(factor2, 30)} (${(Number(ethers.utils.formatUnits(factor2, 30)) * 100).toFixed(2)}%)\n`);
  } catch (error) {
    console.log("Error with exponent=2:", error.message);
  }

  // Test with smaller imbalance (5%)
  console.log("=== Smaller Imbalance Test (5% imbalance) ===\n");
  const longOI2 = ethers.utils.parseUnits("21000", 30);  // $21,000
  const shortOI2 = ethers.utils.parseUnits("19000", 30);  // $19,000
  const diffUsd2 = longOI2.sub(shortOI2);                 // $2,000
  const totalOI2 = longOI2.add(shortOI2);                 // $40,000

  console.log(`Long OI: ${ethers.utils.formatUnits(longOI2, 30)} USD`);
  console.log(`Short OI: ${ethers.utils.formatUnits(shortOI2, 30)} USD`);
  console.log(`Diff USD: ${ethers.utils.formatUnits(diffUsd2, 30)} USD`);
  console.log(`Imbalance: 5%\n`);

  console.log("With Exponent = 1:");
  try {
    const diffAfterExp1_2 = await precision.applyExponentFactor(diffUsd2, exponent1);
    const factor1_2 = await precision.toFactor(diffAfterExp1_2, totalOI2, false);
    console.log(`Factor: ${ethers.utils.formatUnits(factor1_2, 30)} (${(Number(ethers.utils.formatUnits(factor1_2, 30)) * 100).toFixed(2)}%)\n`);
  } catch (error) {
    console.log("Error:", error.message, "\n");
  }

  console.log("With Exponent = 2:");
  try {
    const diffAfterExp2_2 = await precision.applyExponentFactor(diffUsd2, exponent2);
    const factor2_2 = await precision.toFactor(diffAfterExp2_2, totalOI2, false);
    console.log(`Factor: ${ethers.utils.formatUnits(factor2_2, 30)} (${(Number(ethers.utils.formatUnits(factor2_2, 30)) * 100).toFixed(2)}%)\n`);
  } catch (error) {
    console.log("Error:", error.message, "\n");
  }

  console.log("=== END ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
