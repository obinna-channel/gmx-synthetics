import { ethers } from "hardhat";
import * as keys from "../utils/keys";

const ADDRESSES = {
  DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
  READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",
  MARKET: "0x5E63276Caae0FF49b2762b98A1d37941AA50F804",
  mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
  mNGN: "0x2e08218698339AFdba205312cc23dAe8c3690827",
};

async function main() {
  console.log("\n=== Checking Pool Limits for Market ===");
  console.log(`Market: ${ADDRESSES.MARKET}\n`);

  const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

  // Get pool amounts using proper keys
  const poolAmountLongKey = keys.poolAmountKey(ADDRESSES.MARKET, ADDRESSES.mUSD);
  const poolAmountShortKey = keys.poolAmountKey(ADDRESSES.MARKET, ADDRESSES.mNGN);

  const poolAmountLong = await dataStore.getUint(poolAmountLongKey);
  const poolAmountShort = await dataStore.getUint(poolAmountShortKey);

  console.log("Pool Amounts:");
  console.log(`  mUSD (long): ${ethers.utils.formatUnits(poolAmountLong, 6)} mUSD`);
  console.log(`  mNGN (short): ${ethers.utils.formatUnits(poolAmountShort, 18)} mNGN`);

  // Get reserve factors using proper keys
  const reserveFactorLongKey = keys.openInterestReserveFactorKey(ADDRESSES.MARKET, true);
  const reserveFactorShortKey = keys.openInterestReserveFactorKey(ADDRESSES.MARKET, false);

  const reserveFactorLong = await dataStore.getUint(reserveFactorLongKey);
  const reserveFactorShort = await dataStore.getUint(reserveFactorShortKey);

  console.log("\nOpen Interest Reserve Factors:");
  console.log(
    `  Long: ${ethers.utils.formatUnits(reserveFactorLong, 30)} (${(
      parseFloat(ethers.utils.formatUnits(reserveFactorLong, 30)) * 100
    ).toFixed(2)}%)`
  );
  console.log(
    `  Short: ${ethers.utils.formatUnits(reserveFactorShort, 30)} (${(
      parseFloat(ethers.utils.formatUnits(reserveFactorShort, 30)) * 100
    ).toFixed(2)}%)`
  );

  // Get current OI using proper keys
  const oiLongKey = keys.openInterestKey(ADDRESSES.MARKET, ADDRESSES.mUSD, true);
  const oiShortKey = keys.openInterestKey(ADDRESSES.MARKET, ADDRESSES.mNGN, false);

  const oiLong = await dataStore.getUint(oiLongKey);
  const oiShort = await dataStore.getUint(oiShortKey);

  console.log("\nCurrent Open Interest:");
  console.log(`  Long: $${ethers.utils.formatUnits(oiLong, 30)}`);
  console.log(`  Short: $${ethers.utils.formatUnits(oiShort, 30)}`);

  // Get max OI limits
  const maxOiLongKey = keys.maxOpenInterestKey(ADDRESSES.MARKET, true);
  const maxOiShortKey = keys.maxOpenInterestKey(ADDRESSES.MARKET, false);

  const maxOiLong = await dataStore.getUint(maxOiLongKey);
  const maxOiShort = await dataStore.getUint(maxOiShortKey);

  console.log("\nMax Open Interest (hard caps):");
  console.log(`  Long: $${ethers.utils.formatUnits(maxOiLong, 30)}`);
  console.log(`  Short: $${ethers.utils.formatUnits(maxOiShort, 30)}`);

  // Calculate limits (assuming $1 price for mUSD)
  const poolValueLong = parseFloat(ethers.utils.formatUnits(poolAmountLong, 6)); // mUSD = $1
  const reserveFactorLongFloat = parseFloat(ethers.utils.formatUnits(reserveFactorLong, 30));
  const maxReservedLong = poolValueLong * reserveFactorLongFloat;

  console.log("\n=== LONG SIDE ANALYSIS ===");
  console.log(`Pool Value: $${poolValueLong.toLocaleString()}`);
  console.log(`Reserve Factor: ${(reserveFactorLongFloat * 100).toFixed(2)}%`);
  console.log(`Max Reserved USD: $${maxReservedLong.toLocaleString()}`);
  console.log(`Current OI: $${parseFloat(ethers.utils.formatUnits(oiLong, 30)).toLocaleString()}`);
  console.log(
    `Available Capacity: $${(maxReservedLong - parseFloat(ethers.utils.formatUnits(oiLong, 30))).toLocaleString()}`
  );

  // For shorts, pool value needs NGN price conversion (assume 1/1476)
  const ngnPrice = 1 / 1476;
  const poolValueShort = parseFloat(ethers.utils.formatUnits(poolAmountShort, 18)) * ngnPrice;
  const reserveFactorShortFloat = parseFloat(ethers.utils.formatUnits(reserveFactorShort, 30));
  const maxReservedShort = poolValueShort * reserveFactorShortFloat;

  console.log("\n=== SHORT SIDE ANALYSIS (assuming mNGN = $" + ngnPrice.toFixed(6) + ") ===");
  console.log(`Pool Value: $${poolValueShort.toLocaleString()}`);
  console.log(`Reserve Factor: ${(reserveFactorShortFloat * 100).toFixed(2)}%`);
  console.log(`Max Reserved USD: $${maxReservedShort.toLocaleString()}`);
  console.log(`Current OI: $${parseFloat(ethers.utils.formatUnits(oiShort, 30)).toLocaleString()}`);
  console.log(
    `Available Capacity: $${(maxReservedShort - parseFloat(ethers.utils.formatUnits(oiShort, 30))).toLocaleString()}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
