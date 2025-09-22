const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking MAX_PNL_FACTOR Settings ===\n");

    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    const MAX_PNL_FACTOR_FOR_DEPOSITS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PNL_FACTOR_FOR_DEPOSITS"])
    );

    // Check for longs
    const pnlKeyLong = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_PNL_FACTOR_FOR_DEPOSITS, MARKET, true]
        )
    );

    // Check for shorts
    const pnlKeyShort = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_PNL_FACTOR_FOR_DEPOSITS, MARKET, false]
        )
    );

    const longFactor = await dataStore.getUint(pnlKeyLong);
    const shortFactor = await dataStore.getUint(pnlKeyShort);

    console.log("MAX_PNL_FACTOR_FOR_DEPOSITS:");
    console.log("  For Longs:", longFactor.toString());
    console.log("  For Shorts:", shortFactor.toString());
    console.log("");
    console.log("  Formatted:");
    console.log("  Longs:", ethers.utils.formatUnits(longFactor, 30) * 100 + "%");
    console.log("  Shorts:", ethers.utils.formatUnits(shortFactor, 30) * 100 + "%");

    if (longFactor.eq(0)) {
        console.log("\n❌ Long factor is 0 - needs to be set!");
    }
    if (shortFactor.eq(0)) {
        console.log("❌ Short factor is 0 - needs to be set!");
    }
    if (!longFactor.eq(0) && !shortFactor.eq(0)) {
        console.log("\n✅ Both factors are set!");
    }
}

main().catch(console.error);
