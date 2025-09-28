const { ethers } = require("hardhat");

async function main() {
    const [signer] = await ethers.getSigners();

    // Contract addresses
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("=== Debugging Short Position ===\n");
    console.log("Account:", signer.address);
    console.log("Market:", MARKET);

    // Check SHORT position
    const isLong = false;

    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [signer.address, MARKET, USDT, isLong]
        )
    );

    console.log("Position Key:", positionKey);

    // Check if position exists
    const POSITION_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionExists = await dataStore.containsBytes32(POSITION_LIST, positionKey);
    console.log("\nPosition exists:", positionExists);

    if (positionExists) {
        // Get detailed position data
        const getPositionData = async (field) => {
            const fieldHash = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(["string"], [field])
            );
            const key = ethers.utils.keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    ["bytes32", "bytes32"],
                    [positionKey, fieldHash]
                )
            );
            return dataStore.getUint(key);
        };

        const sizeInUsd = await getPositionData("SIZE_IN_USD");
        const sizeInTokens = await getPositionData("SIZE_IN_TOKENS");
        const collateralAmount = await getPositionData("COLLATERAL_AMOUNT");
        const borrowingFactor = await getPositionData("BORROWING_FACTOR");
        const fundingFeeAmountPerSize = await getPositionData("FUNDING_FEE_AMOUNT_PER_SIZE");
        const longTokenClaimableFundingAmountPerSize = await getPositionData("LONG_TOKEN_CLAIMABLE_FUNDING_AMOUNT_PER_SIZE");
        const shortTokenClaimableFundingAmountPerSize = await getPositionData("SHORT_TOKEN_CLAIMABLE_FUNDING_AMOUNT_PER_SIZE");

        console.log("\n📊 Position Details:");
        console.log("  Size in USD:", ethers.utils.formatUnits(sizeInUsd, 30), "USD");
        console.log("  Size in Tokens:", ethers.utils.formatUnits(sizeInTokens, 18));
        console.log("  Collateral Amount:", ethers.utils.formatUnits(collateralAmount, 6), "USDT");
        console.log("  Borrowing Factor:", borrowingFactor.toString());
        console.log("  Funding Fee Amount Per Size:", fundingFeeAmountPerSize.toString());

        // Check market configuration
        console.log("\n📍 Checking Market Configuration...");

        // MIN_POSITION_SIZE_USD
        const MIN_POSITION_SIZE_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_POSITION_SIZE_USD"])),
                    MARKET
                ]
            )
        );

        const minPositionSize = await dataStore.getUint(MIN_POSITION_SIZE_KEY);
        console.log("\n  Min Position Size:", ethers.utils.formatUnits(minPositionSize, 30), "USD");

        // MIN_COLLATERAL_USD
        const MIN_COLLATERAL_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_COLLATERAL_USD"])),
                    MARKET
                ]
            )
        );

        const minCollateralUsd = await dataStore.getUint(MIN_COLLATERAL_KEY);
        console.log("  Min Collateral:", ethers.utils.formatUnits(minCollateralUsd, 30), "USD");

        // Check pool amounts for the market
        console.log("\n📊 Market Pool Amounts:");

        // Pool amount for USDT (long token)
        const POOL_AMOUNT_KEY_USDT = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])),
                    MARKET,
                    USDT
                ]
            )
        );

        const poolAmountUSDT = await dataStore.getUint(POOL_AMOUNT_KEY_USDT);
        console.log("  USDT Pool:", ethers.utils.formatUnits(poolAmountUSDT, 6), "USDT");

        // Pool amount for sNGN (short token)
        const POOL_AMOUNT_KEY_sNGN = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])),
                    MARKET,
                    sNGN
                ]
            )
        );

        const poolAmountsNGN = await dataStore.getUint(POOL_AMOUNT_KEY_sNGN);
        console.log("  sNGN Pool:", ethers.utils.formatUnits(poolAmountsNGN, 18), "sNGN");

        // Check open interest
        console.log("\n📈 Open Interest:");

        // Open interest for shorts
        const OPEN_INTEREST_KEY = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address", "bool"],
                [
                    ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])),
                    MARKET,
                    USDT,
                    false // isLong = false for shorts
                ]
            )
        );

        const openInterest = await dataStore.getUint(OPEN_INTEREST_KEY);
        console.log("  Short Open Interest:", ethers.utils.formatUnits(openInterest, 30), "USD");

        // Check if trying to close position would violate any constraints
        console.log("\n⚠️  Potential Issues:");

        if (sizeInUsd.eq(0)) {
            console.log("  - Position size is already 0!");
        }

        if (collateralAmount.eq(0)) {
            console.log("  - Collateral amount is already 0!");
        }

        // Calculate what would happen after decrease
        const remainingSize = ethers.BigNumber.from(0); // Closing entire position
        const remainingCollateral = ethers.BigNumber.from(0);

        console.log("\n📝 After Full Close:");
        console.log("  Remaining Size:", ethers.utils.formatUnits(remainingSize, 30), "USD");
        console.log("  Remaining Collateral:", ethers.utils.formatUnits(remainingCollateral, 6), "USDT");

    } else {
        console.log("\n❌ No SHORT position found!");
    }

    // Check for any pending orders
    console.log("\n📋 Checking for pending orders...");

    const ORDER_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"])
    );

    const ACCOUNT_ORDER_COUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_ORDER_COUNT"])),
                signer.address
            ]
        )
    );

    const orderCount = await dataStore.getUint(ACCOUNT_ORDER_COUNT_KEY);
    console.log("  Open orders for account:", orderCount.toString());
}

main().catch(console.error);