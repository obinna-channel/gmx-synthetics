import { ethers } from "hardhat";
import * as keys from "../utils/keys";

const MARKET = "0x5E63276Caae0FF49b2762b98A1d37941AA50F804";
const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

async function main() {
  const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

  const reserveFactorLongKey = keys.reserveFactorKey(MARKET, true);
  const reserveFactorShortKey = keys.reserveFactorKey(MARKET, false);

  const reserveFactorLong = await dataStore.getUint(reserveFactorLongKey);
  const reserveFactorShort = await dataStore.getUint(reserveFactorShortKey);

  console.log("Reserve Factors (different from OI Reserve Factor):");
  console.log(`  Long: ${(parseFloat(ethers.utils.formatUnits(reserveFactorLong, 30)) * 100).toFixed(2)}%`);
  console.log(`  Short: ${(parseFloat(ethers.utils.formatUnits(reserveFactorShort, 30)) * 100).toFixed(2)}%`);
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
