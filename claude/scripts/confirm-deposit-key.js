const { ethers } = require("hardhat");

async function main() {
    console.log("=== Confirming Stuck Deposit Key ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check DEPOSIT_LIST
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );

    const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
    console.log("Number of deposits in DEPOSIT_LIST:", depositCount.toString());

    if (depositCount.gt(0)) {
        for (let i = 0; i < depositCount.toNumber(); i++) {
            const depositKeys = await dataStore.getBytes32ValuesAt(DEPOSIT_LIST, i, i + 1);
            const depositKey = depositKeys[0];
            console.log(`\nDeposit #${i + 1}:`);
            console.log("  Key:", depositKey);

            // Read basic info about this deposit
            const ACCOUNT = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"]));
            const MARKET = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET"]));
            const INITIAL_LONG_TOKEN_AMOUNT = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_LONG_TOKEN_AMOUNT"]));
            const INITIAL_SHORT_TOKEN_AMOUNT = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_SHORT_TOKEN_AMOUNT"]));

            const accountKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, ACCOUNT])
            );
            const account = await dataStore.getAddress(accountKey);

            const marketKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, MARKET])
            );
            const market = await dataStore.getAddress(marketKey);

            const longAmountKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_LONG_TOKEN_AMOUNT])
            );
            const longAmount = await dataStore.getUint(longAmountKey);

            const shortAmountKey = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_SHORT_TOKEN_AMOUNT])
            );
            const shortAmount = await dataStore.getUint(shortAmountKey);

            console.log("  Account:", account);
            console.log("  Market:", market);
            console.log("  USDT amount:", ethers.utils.formatUnits(longAmount, 6));
            console.log("  sNGN amount:", ethers.utils.formatUnits(shortAmount, 18));

            if (market === "0x53b49A28054D108d7050B0E5C317001bE984EB2D") {
                console.log("  ✅ This is the original sNGN market");
            } else if (market === "0x8E4C5f3296A100d4135187C3181258cb8a223bb1") {
                console.log("  This is the new USDT market");
            }
        }
    }

    console.log("\n📝 The deposit key to cancel is:");
    console.log("0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696");
}

main().catch(console.error);