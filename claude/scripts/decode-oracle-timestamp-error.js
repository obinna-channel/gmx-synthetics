const { ethers } = require("hardhat");

async function main() {
    // Error from the failed execution
    const errorData = "0xd84b8ee80000000000000000000000000000000000000000000000000000000068d3914f0000000000000000000000000000000000000000000000000000000068d38f1a000000000000000000000000000000000000000000000000000000000000012c";

    // Remove function selector (first 10 chars)
    const params = "0x" + errorData.slice(10);

    const decoded = ethers.utils.defaultAbiCoder.decode(
        ["uint256", "uint256", "uint256"],
        params
    );

    console.log("=== OracleBlockNumbersAreSmallerThanRequired Error Analysis ===\n");

    // These are actually timestamps, not block numbers
    const oracleTimestamp = decoded[0];
    const minRequiredTimestamp = decoded[1];
    const constant = decoded[2];

    console.log("Oracle timestamp:", oracleTimestamp.toString());
    console.log("Min required timestamp:", minRequiredTimestamp.toString());
    console.log("Constant (300):", constant.toString());
    console.log("\nDifference:", oracleTimestamp.sub(minRequiredTimestamp).toString(), "seconds");

    // Get current time
    const block = await ethers.provider.getBlock("latest");
    const jsTime = Math.floor(Date.now() / 1000);

    console.log("\n📍 Current State:");
    console.log("Current block timestamp:", block.timestamp);
    console.log("JavaScript timestamp:", jsTime);

    const depositAge = block.timestamp - minRequiredTimestamp.toNumber();
    console.log("\n📊 Analysis:");
    console.log("Deposit creation time:", minRequiredTimestamp.toString());
    console.log("Deposit age:", depositAge, "seconds (", Math.floor(depositAge / 60), "minutes)");

    if (depositAge > 300) {
        console.log("❌ Deposit is EXPIRED (> 300 seconds old)");
    }

    console.log("\n💡 The error is saying:");
    console.log("Oracle timestamp (" + oracleTimestamp.toString() + ") < min required (" + minRequiredTimestamp.toString() + ")");
    console.log("We need to set oracle timestamp to at least:", minRequiredTimestamp.toString());
    console.log("Or better yet, to current time:", block.timestamp);
}

main().catch(console.error);