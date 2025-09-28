const { ethers } = require("hardhat");

async function main() {
    console.log("=== Debugging Decrease Order Requirements ===\n");

    // Contracts and addresses
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const account = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // 1. Check position details
    console.log("📊 Current Position:");
    const positionKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address", "bool"],
            [account, MARKET, USDT, true] // long position
        )
    );

    // Helper to get position data
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

    console.log("  Size (USD):", ethers.utils.formatUnits(sizeInUsd, 30));
    console.log("  Size (Tokens):", ethers.utils.formatUnits(sizeInTokens, 18));
    console.log("  Collateral:", ethers.utils.formatUnits(collateralAmount, 6), "USDT");

    // 2. Check market configuration
    console.log("\n📍 Market Configuration:");

    // Min collateral USD
    const MIN_COLLATERAL_USD = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_COLLATERAL_USD"])
    );
    const minCollateralUsd = await dataStore.getUint(MIN_COLLATERAL_USD);
    console.log("  Min Collateral USD:", ethers.utils.formatUnits(minCollateralUsd, 30));

    // Min position size USD
    const MIN_POSITION_SIZE_USD = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_POSITION_SIZE_USD"])
    );
    const minPositionSizeUsd = await dataStore.getUint(MIN_POSITION_SIZE_USD);
    console.log("  Min Position Size USD:", ethers.utils.formatUnits(minPositionSizeUsd, 30));

    // Check market-specific min collateral
    const minCollateralKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [MIN_COLLATERAL_USD, MARKET]
        )
    );
    const marketMinCollateral = await dataStore.getUint(minCollateralKey);
    if (marketMinCollateral.gt(0)) {
        console.log("  Market-specific Min Collateral:", ethers.utils.formatUnits(marketMinCollateral, 30));
    }

    // 3. Check decrease order settings
    console.log("\n⚙️ Decrease Order Settings:");

    // Min collateral for long
    const MIN_COLLATERAL_USD_FOR_LONG = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MIN_COLLATERAL_USD, MARKET, true]
        )
    );
    const minCollateralForLong = await dataStore.getUint(MIN_COLLATERAL_USD_FOR_LONG);
    if (minCollateralForLong.gt(0)) {
        console.log("  Min Collateral for Long:", ethers.utils.formatUnits(minCollateralForLong, 30));
    }

    // 4. Calculate what would happen with a $10 decrease
    console.log("\n📐 Decrease Simulation (10 USD):");
    const decreaseAmount = ethers.utils.parseUnits("10", 30);

    const newSize = sizeInUsd.sub(decreaseAmount);
    console.log("  New Size:", ethers.utils.formatUnits(newSize, 30), "USD");

    // Proportional collateral reduction
    const collateralReduction = collateralAmount.mul(decreaseAmount).div(sizeInUsd);
    const newCollateral = collateralAmount.sub(collateralReduction);
    console.log("  New Collateral:", ethers.utils.formatUnits(newCollateral, 6), "USDT");
    console.log("  (Reduced by:", ethers.utils.formatUnits(collateralReduction, 6), "USDT)");

    // Check if new collateral meets minimum (assuming $1 = 1 USDT)
    const newCollateralUsd = newCollateral.mul(10).pow(24); // Convert to 30 decimals
    console.log("  New Collateral USD:", ethers.utils.formatUnits(newCollateralUsd, 30));

    // 5. Check if there are any special flags or requirements
    console.log("\n🔍 Additional Checks:");

    // Check if decreases are disabled
    const DISABLE_DECREASE_ORDER_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DISABLE_DECREASE_ORDER_FEATURE"])
    );
    const decreasesDisabled = await dataStore.getBool(DISABLE_DECREASE_ORDER_KEY);
    console.log("  Decrease orders disabled:", decreasesDisabled);

    // Check auto-deleveraging
    const AUTO_DELEVERAGING_ENABLED = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["IS_AUTO_DELEVERAGING_ENABLED"])),
                MARKET
            ]
        )
    );
    const autoDeleveraging = await dataStore.getBool(AUTO_DELEVERAGING_ENABLED);
    console.log("  Auto-deleveraging enabled:", autoDeleveraging);

    // 6. Check swap paths and fees
    console.log("\n💱 Swap Configuration:");

    // Swap fee factor
    const SWAP_FEE_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["SWAP_FEE_FACTOR"])),
                MARKET
            ]
        )
    );
    const swapFeeFactor = await dataStore.getUint(SWAP_FEE_FACTOR);
    if (swapFeeFactor.gt(0)) {
        console.log("  Swap fee factor:", swapFeeFactor.toString(), "(", swapFeeFactor.mul(100).div(10**30).toString(), "%)");
    }

    // 7. Summary
    console.log("\n📝 Summary:");

    if (newCollateralUsd.lt(minCollateralUsd)) {
        console.log("  ❌ New collateral would be below minimum!");
        console.log("     Required:", ethers.utils.formatUnits(minCollateralUsd, 30), "USD");
        console.log("     Would have:", ethers.utils.formatUnits(newCollateralUsd, 30), "USD");
    } else if (newSize.lt(minPositionSizeUsd) && newSize.gt(0)) {
        console.log("  ❌ New position size would be below minimum!");
        console.log("     Required:", ethers.utils.formatUnits(minPositionSizeUsd, 30), "USD");
        console.log("     Would have:", ethers.utils.formatUnits(newSize, 30), "USD");
    } else if (decreasesDisabled) {
        console.log("  ❌ Decrease orders are disabled!");
    } else {
        console.log("  ✅ Decrease should be valid based on these checks");
        console.log("  🤔 Cancellation might be due to:");
        console.log("     - Price impact limits");
        console.log("     - Liquidity issues");
        console.log("     - Oracle price validation");
        console.log("     - Swap path issues");
    }
}

main().catch(console.error);