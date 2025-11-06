import hre from "hardhat";
import { hashData } from "../utils/hash";
const ethers = hre.ethers;

async function main() {
  const dataStoreDeployment = await hre.deployments.get("DataStore");
  const reader = await hre.ethers.getContract("Reader");

  const traderAddress = process.env.TRADER || "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
  console.log("Fetching positions for:", traderAddress);

  const positions = await reader.getAccountPositions(dataStoreDeployment.address, traderAddress, 0, 20);

  if (positions.length === 0) {
    console.log("No positions found");
    return;
  }

  for (const position of positions) {
    console.log("\n=== POSITION DATA ===");
    console.log("Market:", position.addresses.market);
    console.log("Collateral:", position.addresses.collateralToken);
    console.log("Is Long:", position.flags.isLong);
    console.log("");
    console.log("Raw BigInt values:");
    console.log("sizeInUsd:", position.numbers.sizeInUsd.toString());
    console.log("sizeInTokens:", position.numbers.sizeInTokens.toString());
    console.log("collateralAmount:", position.numbers.collateralAmount.toString());
    console.log("");

    // Calculate entry price
    const sizeInUsd = position.numbers.sizeInUsd;
    const sizeInTokens = position.numbers.sizeInTokens;

    if (sizeInTokens > 0n) {
      const priceIn12Decimals = sizeInUsd / sizeInTokens;
      const entryPrice = Number(priceIn12Decimals) / 1e12;
      console.log("Calculated entry price (sizeInUsd / sizeInTokens):", entryPrice);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
