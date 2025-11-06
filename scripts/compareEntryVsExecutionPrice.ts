import hre from "hardhat";
import { hashData } from "../utils/hash";
import { formatAmount } from "../utils/math";
const ethers = hre.ethers;

async function main() {
  const dataStoreDeployment = await hre.deployments.get("DataStore");
  const referralStorageDeployment = await hre.deployments.get("ReferralStorage");
  const reader = await hre.ethers.getContract("Reader");

  const traderAddress = process.env.TRADER || "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
  console.log("Fetching positions for:", traderAddress);

  const positions = await reader.getAccountPositions(dataStoreDeployment.address, traderAddress, 0, 20);

  if (positions.length === 0) {
    console.log("No positions found");
    return;
  }

  for (const position of positions) {
    console.log("\n=== POSITION ===");
    console.log("Market:", position.addresses.market);
    console.log("Is Long:", position.flags.isLong);
    console.log("");

    // Calculate entry price from stored position data
    const sizeInUsd = position.numbers.sizeInUsd;
    const sizeInTokens = position.numbers.sizeInTokens;

    let calculatedEntryPrice = 0;
    if (sizeInTokens > 0n) {
      const priceIn12Decimals = sizeInUsd / sizeInTokens;
      calculatedEntryPrice = Number(priceIn12Decimals) / 1e12;
    }

    console.log("📊 Stored Position Data:");
    console.log("  sizeInUsd:", formatAmount(sizeInUsd, 30, 4));
    console.log("  sizeInTokens:", formatAmount(sizeInTokens, 18, 6));
    console.log("  Calculated Entry Price (sizeInUsd / sizeInTokens):", calculatedEntryPrice.toFixed(4));
    console.log("");

    // Get market data for prices
    const market = await reader.getMarket(dataStoreDeployment.address, position.addresses.market);

    // Use simple mock prices for now (you can adjust these)
    const mockPrice = calculatedEntryPrice * 1e12; // Use calculated price as baseline
    const prices = {
      indexTokenPrice: { min: mockPrice, max: mockPrice },
      longTokenPrice: { min: mockPrice, max: mockPrice },
      shortTokenPrice: { min: mockPrice, max: mockPrice },
    };

    // Generate position key
    const positionKey = hashData(
      ["address", "address", "address", "bool"],
      [position.addresses.account, position.addresses.market, position.addresses.collateralToken, position.flags.isLong]
    );

    try {
      // Get position info which includes executionPriceResult
      const positionInfo = await reader.getPositionInfo(
        dataStoreDeployment.address,
        referralStorageDeployment.address,
        positionKey,
        prices,
        0, // sizeDeltaUsd (0 means we're not closing)
        ethers.constants.AddressZero,
        true
      );

      console.log("📈 Reader's Execution Price Result:");
      console.log("  executionPrice:", formatAmount(positionInfo.executionPriceResult.executionPrice, 12, 4));
      console.log("  priceImpactUsd:", formatAmount(positionInfo.executionPriceResult.priceImpactUsd, 30, 4));
      console.log("");

      const readerExecutionPrice = Number(positionInfo.executionPriceResult.executionPrice) / 1e12;
      const difference = readerExecutionPrice - calculatedEntryPrice;
      const diffPercent = (difference / calculatedEntryPrice) * 100;

      console.log("🔍 Comparison:");
      console.log("  Entry Price (from position):    ", calculatedEntryPrice.toFixed(4));
      console.log("  Execution Price (from Reader):  ", readerExecutionPrice.toFixed(4));
      console.log("  Difference:                     ", difference.toFixed(4), `(${diffPercent.toFixed(4)}%)`);
    } catch (error) {
      console.log("❌ Error getting position info:", error.message);
    }

    console.log("=".repeat(60));
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
