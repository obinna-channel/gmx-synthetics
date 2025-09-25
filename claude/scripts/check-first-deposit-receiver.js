const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking RECEIVER_FOR_FIRST_DEPOSIT Configuration ===\n");

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Check RECEIVER_FOR_FIRST_DEPOSIT
    const RECEIVER_FOR_FIRST_DEPOSIT_KEY = ethers.utils.id("RECEIVER_FOR_FIRST_DEPOSIT");
    const receiverForFirstDeposit = await dataStore.getAddress(RECEIVER_FOR_FIRST_DEPOSIT_KEY);
    
    console.log("RECEIVER_FOR_FIRST_DEPOSIT:", receiverForFirstDeposit);
    
    if (receiverForFirstDeposit === ethers.constants.AddressZero) {
        console.log("\n⚠️  WARNING: RECEIVER_FOR_FIRST_DEPOSIT is not set!");
        console.log("This means the first deposit should use address(1) as receiver.");
        console.log("Address(1):", "0x0000000000000000000000000000000000000001");
    } else {
        console.log("\n✅ RECEIVER_FOR_FIRST_DEPOSIT is configured.");
        console.log("First deposit must use this address as the receiver.");
    }

    // Also check if market has any deposits
    const MARKET = "0x53b49A28054D108d7050B0E5C317001bE984EB2D";
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const depositListKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [DEPOSIT_LIST, MARKET]
        )
    );

    const depositCount = await dataStore.getBytes32Count(depositListKey);
    console.log("\nMarket deposit count:", depositCount.toString());
    
    if (depositCount.eq(0)) {
        console.log("📍 This is a brand new market with no deposits.");
        console.log("The first deposit MUST use the receiver address shown above.");
    } else {
        console.log("📍 This market already has deposits.");
        console.log("Normal receiver addresses can be used.");
    }
}

main().catch(console.error);