const { ethers } = require("hardhat");

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
};

const ADDRESSES = {
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    TSLA_MARKET: "0x8ae559448a1482faffC925eF6a233276588348Df",
};

async function checkPositionHistory() {
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    console.log("\n=== Checking TSLA Position History ===\n");

    const BASE_CUMULATIVE_BORROWING_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CUMULATIVE_BORROWING_FACTOR"])
    );
    const cumulativeBorrowingFactorKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [BASE_CUMULATIVE_BORROWING_FACTOR, ADDRESSES.TSLA_MARKET, false]
        )
    );

    const currentCumulativeBorrowing = await dataStore.getUint(cumulativeBorrowingFactorKey);

    console.log("Current Market State:");
    console.log("  Cumulative Borrowing Factor (SHORT):", currentCumulativeBorrowing.toString());
    console.log("  Scaled (30 decimals):", ethers.utils.formatUnits(currentCumulativeBorrowing, 30), "\n");

    console.log("Position Data (from logs):");
    console.log("  Position borrowingFactor: 143694714410747739961566");
    console.log("  Scaled (30 decimals):", ethers.utils.formatUnits("143694714410747739961566", 30), "\n");

    const positionBorrowingFactor = ethers.BigNumber.from("143694714410747739961566");
    const positionSize = ethers.utils.parseUnits("997.5", 30);

    const diff = currentCumulativeBorrowing.sub(positionBorrowingFactor);
    const expectedBorrowingFee = positionSize.mul(diff).div(ethers.utils.parseUnits("1", 30));

    console.log("Expected Borrowing Fee Calculation:");
    console.log("  Difference:", diff.toString());
    console.log("  Scaled diff:", ethers.utils.formatUnits(diff, 30));
    console.log("  Position Size: $", ethers.utils.formatUnits(positionSize, 30));
    console.log("  Expected Fee: $", ethers.utils.formatUnits(expectedBorrowingFee, 30), "\n");

    console.log("Actual Fee from Reader:");
    console.log("  Actual Fee: $1,060,501,944,389.68\n");

    console.log("Analysis:");
    const multiplier = currentCumulativeBorrowing.mul(100).div(positionBorrowingFactor).toNumber() / 100;
    console.log("  Position borrowingFactor is", multiplier, "x smaller than current");
    console.log("  Actual fee is ~2,252,000,000,000x higher than expected!");
}

async function main() {
    try {
        await checkPositionHistory();
    } catch (error) {
        console.error("Error:", error.message);
        console.error(error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
