const { ethers } = require("hardhat");

// Market configurations for Markets 11-18
const MARKETS = {
    "mTSLA": {
        marketAddress: "0x8ae559448a1482faffC925eF6a233276588348Df",
        indexToken: "0x77d4DdD2E847592fb7710e342C0492A4b85655f4",
        longToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        shortToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        name: "mTSLA [mUSD-mUSD]",
        indexDecimals: 18,
        longDecimals: 6,
        shortDecimals: 6
    },
    "mUSDTARS": {
        marketAddress: "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69",
        indexToken: "0xed6890bE2409F0db06a00C809a298E2E06553BE1",
        longToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        shortToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        name: "mUSDTARS [mUSD-mUSD]",
        indexDecimals: 18,
        longDecimals: 6,
        shortDecimals: 6
    },
    "mNVDA": {
        marketAddress: "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C",
        indexToken: "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325",
        longToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        shortToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        name: "mNVDA [mUSD-mUSD]",
        indexDecimals: 18,
        longDecimals: 6,
        shortDecimals: 6
    },
    "mPKR": {
        marketAddress: "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383",
        indexToken: "0xDC7e9F5a3D337161880d084131BC16214f2F8EBD",
        longToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        shortToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        name: "mPKR [mUSD-mUSD]",
        indexDecimals: 18,
        longDecimals: 6,
        shortDecimals: 6
    },
    "mCOP": {
        marketAddress: "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44",
        indexToken: "0x8d9C2d46d6ff665afb4deb6CBc1Ed5E31eB455b8",
        longToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        shortToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        name: "mCOP [mUSD-mUSD]",
        indexDecimals: 18,
        longDecimals: 6,
        shortDecimals: 6
    },
    "mAAPL": {
        marketAddress: "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449",
        indexToken: "0x7C32072A5f0C73f9a619a51fdF9A311AEABcD50e",
        longToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        shortToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        name: "mAAPL [mUSD-mUSD]",
        indexDecimals: 18,
        longDecimals: 6,
        shortDecimals: 6
    },
    "mMETA": {
        marketAddress: "0xafd908D358315efDBA493311AbE30648DEC4d2dE",
        indexToken: "0xE2f8B015D23bB0EFdD57D8C08a328180437D031D",
        longToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        shortToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        name: "mMETA [mUSD-mUSD]",
        indexDecimals: 18,
        longDecimals: 6,
        shortDecimals: 6
    },
    "mUSDTNGN": {
        marketAddress: "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb",
        indexToken: "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73",
        longToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        shortToken: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf", // mUSD
        name: "mUSDTNGN [mUSD-mUSD]",
        indexDecimals: 18,
        longDecimals: 6,
        shortDecimals: 6
    }
};

const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";

async function main() {
    // Get market from environment variable
    const marketSymbol = process.env.MARKET;

    if (!marketSymbol) {
        console.log("❌ Error: Please specify a market using the MARKET environment variable");
        console.log("\nUsage: MARKET=mTSLA npx hardhat run claude/scripts/check-market-liquidity-detailed.js --network arbitrumSepolia");
        console.log("\nAvailable markets:");
        Object.keys(MARKETS).forEach(symbol => {
            console.log(`  - ${symbol}: ${MARKETS[symbol].name}`);
        });
        process.exit(1);
    }

    const marketConfig = MARKETS[marketSymbol];
    if (!marketConfig) {
        console.log(`❌ Error: Unknown market "${marketSymbol}"`);
        console.log("\nAvailable markets:");
        Object.keys(MARKETS).forEach(symbol => {
            console.log(`  - ${symbol}: ${MARKETS[symbol].name}`);
        });
        process.exit(1);
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  Market Liquidity Report: ${marketConfig.name}`);
    console.log("═══════════════════════════════════════════════════════════\n");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const marketToken = await ethers.getContractAt("IERC20", marketConfig.marketAddress);

    // ========== 1. POOL LIQUIDITY ==========
    console.log("📊 POOL LIQUIDITY (LP Deposits)");
    console.log("───────────────────────────────────────────────────────────");

    const POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );

    const longPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT, marketConfig.marketAddress, marketConfig.longToken]
        )
    );
    const longPoolAmount = await dataStore.getUint(longPoolKey);

    const shortPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT, marketConfig.marketAddress, marketConfig.shortToken]
        )
    );
    const shortPoolAmount = await dataStore.getUint(shortPoolKey);

    // Check if long and short tokens are the same (e.g., mUSD-mUSD markets)
    const isSameToken = marketConfig.longToken.toLowerCase() === marketConfig.shortToken.toLowerCase();

    if (isSameToken) {
        console.log(`  Pool Amount: ${ethers.utils.formatUnits(longPoolAmount, marketConfig.longDecimals)} mUSD`);
        console.log(`  (Note: Long and short tokens are the same)`);
    } else {
        console.log(`  Long Token Pool:  ${ethers.utils.formatUnits(longPoolAmount, marketConfig.longDecimals)} mUSD`);
        console.log(`  Short Token Pool: ${ethers.utils.formatUnits(shortPoolAmount, marketConfig.shortDecimals)} mUSD`);
        console.log(`  Total Pool:       ${ethers.utils.formatUnits(longPoolAmount.add(shortPoolAmount), 6)} mUSD`);
    }

    // For calculations below, use actual total
    const totalPoolAmount = isSameToken ? longPoolAmount : longPoolAmount.add(shortPoolAmount);

    // ========== 1B. POSITION COLLATERAL ==========
    console.log("\n💰 POSITION COLLATERAL");
    console.log("───────────────────────────────────────────────────────────");

    const COLLATERAL_SUM = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["COLLATERAL_SUM"])
    );

    const collateralLongKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [COLLATERAL_SUM, marketConfig.marketAddress, marketConfig.longToken, true]
        )
    );
    const collateralLong = await dataStore.getUint(collateralLongKey);

    const collateralShortKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [COLLATERAL_SUM, marketConfig.marketAddress, marketConfig.shortToken, false]
        )
    );
    const collateralShort = await dataStore.getUint(collateralShortKey);

    console.log(`  Long Collateral:  ${ethers.utils.formatUnits(collateralLong, marketConfig.longDecimals)} mUSD`);
    console.log(`  Short Collateral: ${ethers.utils.formatUnits(collateralShort, marketConfig.shortDecimals)} mUSD`);
    console.log(`  Total Collateral: ${ethers.utils.formatUnits(collateralLong.add(collateralShort), 6)} mUSD`);

    // ========== 2. OPEN INTEREST ==========
    console.log("\n💼 OPEN INTEREST (Active Positions)");
    console.log("───────────────────────────────────────────────────────────");

    const OPEN_INTEREST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST"])
    );

    // Long OI (using long token as collateral)
    const longOIKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST, marketConfig.marketAddress, marketConfig.longToken, true]
        )
    );
    const longOI = await dataStore.getUint(longOIKey);

    // Short OI (using short token as collateral)
    const shortOIKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST, marketConfig.marketAddress, marketConfig.shortToken, false]
        )
    );
    const shortOI = await dataStore.getUint(shortOIKey);

    const OPEN_INTEREST_IN_TOKENS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_IN_TOKENS"])
    );

    const longOITokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_IN_TOKENS, marketConfig.marketAddress, marketConfig.longToken, true]
        )
    );
    const longOITokens = await dataStore.getUint(longOITokensKey);

    const shortOITokensKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [OPEN_INTEREST_IN_TOKENS, marketConfig.marketAddress, marketConfig.shortToken, false]
        )
    );
    const shortOITokens = await dataStore.getUint(shortOITokensKey);

    console.log(`  Long OI:  $${ethers.utils.formatUnits(longOI, 30)} (${ethers.utils.formatUnits(longOITokens, marketConfig.indexDecimals)} ${marketSymbol})`);
    console.log(`  Short OI: $${ethers.utils.formatUnits(shortOI, 30)} (${ethers.utils.formatUnits(shortOITokens, marketConfig.indexDecimals)} ${marketSymbol})`);

    const totalOI = longOI.add(shortOI);
    const oiImbalance = longOI.sub(shortOI);
    console.log(`  Total OI: $${ethers.utils.formatUnits(totalOI, 30)}`);
    console.log(`  Imbalance: ${oiImbalance.isNegative() ? '-' : '+'}$${ethers.utils.formatUnits(oiImbalance.abs(), 30)} (${oiImbalance.isNegative() ? 'net short' : 'net long'})`);

    // ========== 3. RESERVED USD & UTILIZATION ==========
    console.log("\n🔓 RESERVED USD & UTILIZATION");
    console.log("───────────────────────────────────────────────────────────");

    // Reserved USD = Open Interest (per GMX code)
    const reservedLong = longOI;
    const reservedShort = shortOI;
    const totalReserved = reservedLong.add(reservedShort);

    // Get Open Interest Reserve Factor
    const OPEN_INTEREST_RESERVE_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["OPEN_INTEREST_RESERVE_FACTOR"])
    );

    const oiReserveFactorLongKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [OPEN_INTEREST_RESERVE_FACTOR, marketConfig.marketAddress, true]
        )
    );
    const oiReserveFactorLong = await dataStore.getUint(oiReserveFactorLongKey);

    const oiReserveFactorShortKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [OPEN_INTEREST_RESERVE_FACTOR, marketConfig.marketAddress, false]
        )
    );
    const oiReserveFactorShort = await dataStore.getUint(oiReserveFactorShortKey);

    // Calculate max reserved: Pool × Reserve Factor
    const totalPoolUSD = totalPoolAmount.mul(ethers.BigNumber.from(10).pow(24)); // Convert to 30 decimals

    // Max reserved per side
    const maxReservedLong = totalPoolUSD.mul(oiReserveFactorLong).div(ethers.BigNumber.from(10).pow(30));
    const maxReservedShort = totalPoolUSD.mul(oiReserveFactorShort).div(ethers.BigNumber.from(10).pow(30));

    // Utilization per side
    const utilizationLong = maxReservedLong.gt(0)
        ? reservedLong.mul(10000).div(maxReservedLong).toNumber() / 100
        : 0;

    const utilizationShort = maxReservedShort.gt(0)
        ? reservedShort.mul(10000).div(maxReservedShort).toNumber() / 100
        : 0;

    console.log(`  Reserved USD (Long):  $${ethers.utils.formatUnits(reservedLong, 30)}`);
    console.log(`  Reserved USD (Short): $${ethers.utils.formatUnits(reservedShort, 30)}`);
    console.log(`  Total Reserved:       $${ethers.utils.formatUnits(totalReserved, 30)}`);
    console.log(``);
    console.log(`  Pool Amount:          $${ethers.utils.formatUnits(totalPoolUSD, 30)}`);
    console.log(`  OI Reserve Factor:    ${ethers.utils.formatUnits(oiReserveFactorLong, 30)} (${(parseFloat(ethers.utils.formatUnits(oiReserveFactorLong, 30)) * 100).toFixed(0)}%)`);
    console.log(``);
    console.log(`  Max Reserved (Long):  $${ethers.utils.formatUnits(maxReservedLong, 30)}`);
    console.log(`  Max Reserved (Short): $${ethers.utils.formatUnits(maxReservedShort, 30)}`);
    console.log(``);
    console.log(`  Utilization (Long):   ${utilizationLong.toFixed(2)}%`);
    console.log(`  Utilization (Short):  ${utilizationShort.toFixed(2)}%`);

    // ========== 4. POSITION IMPACT POOL ==========
    console.log("\n📉 POSITION IMPACT POOL (Negative Price Impacts)");
    console.log("───────────────────────────────────────────────────────────");

    const POSITION_IMPACT_POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_IMPACT_POOL_AMOUNT"])
    );

    const posImpactPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address"],
            [POSITION_IMPACT_POOL_AMOUNT, marketConfig.marketAddress]
        )
    );
    const posImpactPool = await dataStore.getUint(posImpactPoolKey);

    console.log(`  Position Impact Pool: ${ethers.utils.formatUnits(posImpactPool, marketConfig.indexDecimals)} ${marketSymbol}`);
    console.log(`  (Accumulated from traders paying negative price impact)`);

    // ========== 5. SWAP IMPACT POOL ==========
    console.log("\n⚡ SWAP IMPACT POOL (Rebalancing Buffer)");
    console.log("───────────────────────────────────────────────────────────");

    const SWAP_IMPACT_POOL_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["SWAP_IMPACT_POOL_AMOUNT"])
    );

    const swapImpactLongKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [SWAP_IMPACT_POOL_AMOUNT, marketConfig.marketAddress, marketConfig.longToken]
        )
    );
    const swapImpactLong = await dataStore.getUint(swapImpactLongKey);

    const swapImpactShortKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [SWAP_IMPACT_POOL_AMOUNT, marketConfig.marketAddress, marketConfig.shortToken]
        )
    );
    const swapImpactShort = await dataStore.getUint(swapImpactShortKey);

    if (isSameToken) {
        console.log(`  Swap Impact Pool: ${ethers.utils.formatUnits(swapImpactLong, marketConfig.longDecimals)} mUSD`);
    } else {
        console.log(`  Long Token:  ${ethers.utils.formatUnits(swapImpactLong, marketConfig.longDecimals)} mUSD`);
        console.log(`  Short Token: ${ethers.utils.formatUnits(swapImpactShort, marketConfig.shortDecimals)} mUSD`);
    }

    // ========== 6. CLAIMABLE FEES ==========
    console.log("\n💰 CLAIMABLE FEES (Actual Trading Fees)");
    console.log("───────────────────────────────────────────────────────────");

    const CLAIMABLE_FEE_AMOUNT = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CLAIMABLE_FEE_AMOUNT"])
    );

    const claimableFeeLongKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [CLAIMABLE_FEE_AMOUNT, marketConfig.marketAddress, marketConfig.longToken]
        )
    );
    const claimableFeeLong = await dataStore.getUint(claimableFeeLongKey);

    const claimableFeeShortKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [CLAIMABLE_FEE_AMOUNT, marketConfig.marketAddress, marketConfig.shortToken]
        )
    );
    const claimableFeeShort = await dataStore.getUint(claimableFeeShortKey);

    if (isSameToken) {
        console.log(`  Claimable Fees: ${ethers.utils.formatUnits(claimableFeeLong, marketConfig.longDecimals)} mUSD`);
    } else {
        console.log(`  Long Token (mUSD):  ${ethers.utils.formatUnits(claimableFeeLong, marketConfig.longDecimals)} mUSD`);
        console.log(`  Short Token (mUSD): ${ethers.utils.formatUnits(claimableFeeShort, marketConfig.shortDecimals)} mUSD`);
        console.log(`  Total Fees:         ${ethers.utils.formatUnits(claimableFeeLong.add(claimableFeeShort), 6)} mUSD`);
    }

    // ========== 7. MARKET TOKEN INFO ==========
    console.log("\n🪙 MARKET TOKEN (LP Token)");
    console.log("───────────────────────────────────────────────────────────");

    const marketTokenSupply = await marketToken.totalSupply();
    console.log(`  Total Supply: ${ethers.utils.formatUnits(marketTokenSupply, 18)} GM-${marketSymbol}`);

    if (marketTokenSupply.gt(0)) {
        // Simple price calculation: (pool value) / (token supply)
        const poolValueUSD = totalPoolAmount;
        const tokenPrice = poolValueUSD.mul(ethers.BigNumber.from(10).pow(18)).div(marketTokenSupply);
        console.log(`  Token Price:  $${ethers.utils.formatUnits(tokenPrice, 6)} per GM token`);
    }

    // ========== 8. MAX LIMITS ==========
    console.log("\n🚧 MAX LIMITS");
    console.log("───────────────────────────────────────────────────────────");

    const MAX_OPEN_INTEREST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_OPEN_INTEREST"])
    );

    const maxOILongKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_OPEN_INTEREST, marketConfig.marketAddress, true]
        )
    );
    const maxOILong = await dataStore.getUint(maxOILongKey);

    const maxOIShortKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_OPEN_INTEREST, marketConfig.marketAddress, false]
        )
    );
    const maxOIShort = await dataStore.getUint(maxOIShortKey);

    const longOIPercent = maxOILong.gt(0) ? longOI.mul(10000).div(maxOILong).toNumber() / 100 : 0;
    const shortOIPercent = maxOIShort.gt(0) ? shortOI.mul(10000).div(maxOIShort).toNumber() / 100 : 0;

    console.log(`  Max Long OI:  $${ethers.utils.formatUnits(maxOILong, 30)} (${longOIPercent.toFixed(2)}% used)`);
    console.log(`  Max Short OI: $${ethers.utils.formatUnits(maxOIShort, 30)} (${shortOIPercent.toFixed(2)}% used)`);

    console.log("\n═══════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
