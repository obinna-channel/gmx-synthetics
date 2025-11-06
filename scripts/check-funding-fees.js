const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const USER = "0x49e082bdda2865a36ed2294819d3c214709cdbaa";

    console.log("=== Checking Funding Fees for User Position ===\n");
    console.log("User:", USER);
    console.log("Market:", MARKET, "\n");

    const reader = await ethers.getContractAt("Reader", READER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get SHORT position key
    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [USER, MARKET, mUSD, false] // SHORT position
        )
    );

    console.log("Position Key:", positionKey, "\n");

    try {
        const position = await reader.getPosition(DATA_STORE, positionKey);

        console.log("📊 Position Details:");
        console.log(`  Size (USD): ${ethers.utils.formatUnits(position.numbers.sizeInUsd, 30)}`);
        console.log(`  Collateral: ${ethers.utils.formatUnits(position.numbers.collateralAmount, 6)} mUSD`);
        console.log(`  Collateral (raw): ${position.numbers.collateralAmount.toString()}`);
        console.log();

        console.log("📈 Funding Tracking:");
        console.log(`  Borrowing Factor: ${position.numbers.borrowingFactor.toString()}`);
        console.log(`  Funding Fee Per Size: ${position.numbers.fundingFeeAmountPerSize.toString()}`);
        console.log();

        // Get market funding fee values from DataStore
        const CUMULATIVE_FUNDING_FACTOR_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["CUMULATIVE_FUNDING_FACTOR_PER_SIZE"])
        );

        // SHORT position uses the short funding factor
        const shortFundingKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [CUMULATIVE_FUNDING_FACTOR_KEY, MARKET, mUSD, false]
            )
        );

        const marketShortFunding = await dataStore.getUint(shortFundingKey);
        console.log("💰 Market Funding State (SHORT):");
        console.log(`  Current Cumulative Funding Factor: ${marketShortFunding.toString()}`);
        console.log();

        // Calculate approximate funding fee owed
        const fundingDelta = marketShortFunding.sub(position.numbers.fundingFeeAmountPerSize);
        console.log("🧮 Estimated Funding Fee:");
        console.log(`  Funding Delta: ${fundingDelta.toString()}`);

        // Funding fee = (sizeInUsd * fundingDelta) / 1e30 (since both are in 30dp)
        // But the result should be in collateral token units (6dp for mUSD)
        const sizeInUsd = position.numbers.sizeInUsd;
        const estimatedFundingFeeUsd30 = sizeInUsd.mul(fundingDelta).div(ethers.utils.parseUnits("1", 30));

        // Convert from 30dp USD to 6dp mUSD (assuming 1 mUSD = 1 USD)
        const estimatedFundingFee = estimatedFundingFeeUsd30.div(ethers.utils.parseUnits("1", 24));

        console.log(`  Estimated Fee (USD, 30dp): ${estimatedFundingFeeUsd30.toString()}`);
        console.log(`  Estimated Fee: ${ethers.utils.formatUnits(estimatedFundingFee, 6)} mUSD`);
        console.log(`  Estimated Fee (raw): ${estimatedFundingFee.toString()}`);
        console.log();

        // Check if collateral is sufficient
        const collateral = position.numbers.collateralAmount;
        console.log("⚠️  Collateral vs Fee:");
        console.log(`  Collateral: ${ethers.utils.formatUnits(collateral, 6)} mUSD`);
        console.log(`  Est. Funding Fee: ${ethers.utils.formatUnits(estimatedFundingFee, 6)} mUSD`);

        if (collateral.lt(estimatedFundingFee)) {
            console.log(`  ❌ INSUFFICIENT! Short by ${ethers.utils.formatUnits(estimatedFundingFee.sub(collateral), 6)} mUSD`);
            console.log();
            console.log("💡 DIAGNOSIS:");
            console.log("The position has accumulated more funding fees than available collateral.");
            console.log("Regular decrease orders CANNOT close positions with insufficient funds.");
            console.log("This position needs to be LIQUIDATED instead.");
        } else {
            const remaining = collateral.sub(estimatedFundingFee);
            console.log(`  ✅ Sufficient! Remaining: ${ethers.utils.formatUnits(remaining, 6)} mUSD`);
        }

    } catch (error) {
        console.log("❌ Error reading position:", error.message);
    }
}

main().catch(console.error);
