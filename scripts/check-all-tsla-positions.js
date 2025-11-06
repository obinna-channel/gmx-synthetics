const { ethers } = require("hardhat");

async function main() {
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const TSLA_MARKET = "0x8ae559448a1482faffC925eF6a233276588348Df";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("\n=== Checking ALL Positions in TSLA Market ===\n");

    // Get long and short open interest
    const longOIKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])),
                TSLA_MARKET,
                mUSD,
                true // isLong
            ]
        )
    );
    
    const shortOIKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])),
                TSLA_MARKET,
                mUSD,
                false // isLong
            ]
        )
    );

    const longOI = await dataStore.getUint(longOIKey);
    const shortOI = await dataStore.getUint(shortOIKey);

    console.log("Long Open Interest:", ethers.utils.formatUnits(longOI, 30), "USD");
    console.log("Short Open Interest:", ethers.utils.formatUnits(shortOI, 30), "USD");
    console.log("Total Open Interest:", ethers.utils.formatUnits(longOI.add(shortOI), 30), "USD");
    
    if (longOI.gt(0) && shortOI.gt(0)) {
        const ratio = shortOI.mul(100).div(longOI.add(shortOI));
        console.log(`\nMarket Balance: ${100 - ratio.toNumber()}% LONG / ${ratio.toNumber()}% SHORT`);
    } else if (longOI.gt(0)) {
        console.log("\nMarket Balance: 100% LONG / 0% SHORT");
    } else if (shortOI.gt(0)) {
        console.log("\nMarket Balance: 0% LONG / 100% SHORT");
    }
}

main().catch(console.error);
