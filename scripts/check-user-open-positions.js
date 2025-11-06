const { ethers } = require("hardhat");

// Market Registry
const MARKETS = {
    "0x8E4C5f3296A100d4135187C3181258cb8a223bb1": { name: "USDT", symbol: "USDT" },
    "0xf7F4Bb2014A164A919Ccec2b97Bd4805f86B83aD": { name: "mUSD", symbol: "mUSD" },
    "0xb0D93252624e03138a261689eDE446F6BEd768BF": { name: "mNGN", symbol: "mNGN" },
    "0x5E63276Caae0FF49b2762b98A1d37941AA50F804": { name: "mUSDTNGN (old)", symbol: "USDTNGN" },
    "0x8ae559448a1482faffC925eF6a233276588348Df": { name: "TSLA", symbol: "mTSLA" },
    "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69": { name: "USDTARS", symbol: "mUSDTARS" },
    "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C": { name: "NVDA", symbol: "mNVDA" },
    "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383": { name: "USDTPKR", symbol: "mPKR" },
    "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44": { name: "USDTCOP", symbol: "mCOP" },
    "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449": { name: "AAPL", symbol: "mAAPL" },
    "0xafd908D358315efDBA493311AbE30648DEC4d2dE": { name: "META", symbol: "mMETA" },
    "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb": { name: "USDTNGN", symbol: "mUSDTNGN" },
};

async function main() {
    const TARGET_USER = process.env.USER_ADDRESS;

    if (!TARGET_USER) {
        console.log("Usage: USER_ADDRESS=0x... npx hardhat run scripts/check-user-open-positions.js --network arbitrumSepolia");
        process.exit(1);
    }

    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";

    console.log("=== Checking User Open Positions ===\n");
    console.log("User:", TARGET_USER);
    console.log();

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Get all position keys
    console.log("📋 Fetching all position keys from DataStore...\n");

    const POSITION_LIST_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionCount = await dataStore.getBytes32Count(POSITION_LIST_KEY);
    console.log("Total positions in system:", positionCount.toString());

    const totalToFetch = Math.min(positionCount.toNumber(), 1000);
    const positionKeys = await dataStore.getBytes32ValuesAt(
        POSITION_LIST_KEY,
        0,
        totalToFetch
    );

    console.log("Fetched", positionKeys.length, "position keys\n");
    console.log("=".repeat(80));

    // Check each position for the user
    const userPositions = [];

    for (const positionKey of positionKeys) {
        try {
            const position = await reader.getPosition(DATA_STORE, positionKey);

            if (position.addresses.account.toLowerCase() === TARGET_USER.toLowerCase()) {
                // Only include active positions (size > 0)
                if (position.numbers.sizeInUsd.gt(0)) {
                    const marketInfo = MARKETS[position.addresses.market.toLowerCase()] ||
                                      MARKETS[position.addresses.market] ||
                                      { name: "UNKNOWN", symbol: "???" };

                    userPositions.push({
                        key: positionKey,
                        position: position,
                        marketInfo: marketInfo
                    });
                }
            }
        } catch (e) {
            // Skip invalid positions
        }
    }

    console.log("\n✅ Found", userPositions.length, "open position(s) for user\n");

    if (userPositions.length === 0) {
        console.log("❌ No open positions found for this user.");
        return;
    }

    console.log("=".repeat(80));

    // Display each position
    for (let i = 0; i < userPositions.length; i++) {
        const { key, position, marketInfo } = userPositions[i];

        console.log(`\n📊 POSITION #${i + 1}:\n`);
        console.log("Market:", marketInfo.name, `(${marketInfo.symbol})`);
        console.log("Market Address:", position.addresses.market);
        console.log("Position Key:", key);
        console.log();

        console.log("Side:", position.flags.isLong ? "🟢 LONG" : "🔴 SHORT");
        console.log("Size:", ethers.utils.formatUnits(position.numbers.sizeInUsd, 30), "USD");
        console.log("Collateral:", ethers.utils.formatUnits(position.numbers.collateralAmount, 6), "mUSD");

        const sizeUsd = parseFloat(ethers.utils.formatUnits(position.numbers.sizeInUsd, 30));
        const collateral = parseFloat(ethers.utils.formatUnits(position.numbers.collateralAmount, 6));
        const leverage = collateral > 0 ? sizeUsd / collateral : 0;
        console.log("Leverage:", leverage.toFixed(2) + "x");
        console.log();

        console.log("Collateral Token:", position.addresses.collateralToken);
        console.log("Increased At:", new Date(position.numbers.increasedAtTime.toNumber() * 1000).toISOString());
        console.log("Decreased At:", new Date(position.numbers.decreasedAtTime.toNumber() * 1000).toISOString());
        console.log();

        console.log("Borrowing Factor:", position.numbers.borrowingFactor.toString());
        console.log("Funding Fee Per Size:", ethers.utils.formatUnits(position.numbers.fundingFeeAmountPerSize, 30));

        console.log("\n" + "-".repeat(80));
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n📈 SUMMARY:\n");
    console.log("Total Open Positions:", userPositions.length);

    const totalSizeUsd = userPositions.reduce((sum, p) => {
        return sum + parseFloat(ethers.utils.formatUnits(p.position.numbers.sizeInUsd, 30));
    }, 0);

    const totalCollateral = userPositions.reduce((sum, p) => {
        return sum + parseFloat(ethers.utils.formatUnits(p.position.numbers.collateralAmount, 6));
    }, 0);

    console.log("Total Size:", totalSizeUsd.toFixed(2), "USD");
    console.log("Total Collateral:", totalCollateral.toFixed(2), "mUSD");
    console.log("Average Leverage:", (totalSizeUsd / totalCollateral).toFixed(2) + "x");
    console.log();
}

main().catch(console.error);
