const { ethers } = require("hardhat");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * Position Snapshot Script - Run BEFORE closing position
 *
 * This script captures all position details BEFORE you close it,
 * so you can later reconcile with the actual payout.
 *
 * Usage:
 * 1. Update ACCOUNT_ADDRESS and MARKET_ADDRESS below
 * 2. Run: npx hardhat run claude/scripts/snapshot-position-before-close.js --network arbitrumSepolia
 * 3. Close your position and note the transaction hash
 * 4. Run the reconciliation script with that tx hash
 */

async function main() {
    // ============ CONFIGURATION ============
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44"; // <-- UPDATE THIS
    const MARKET_ADDRESS = "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb"; // <-- UPDATE THIS (or leave blank for all markets)
    const IS_LONG = true; // <-- true for LONG, false for SHORT

    // Contract addresses
    const ADDRESSES = {
        DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
        READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",
        REFERRAL_STORAGE: "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547",
        mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    };

    const MARKETS = {
        "0x8ae559448a1482faffC925eF6a233276588348Df": { name: "TSLA", pricePair: "TSLA" },
        "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69": { name: "USDTARS", pricePair: "USDTARS" },
        "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C": { name: "NVDA", pricePair: "NVDA" },
        "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383": { name: "USDTPKR", pricePair: "USDTPKR" },
        "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44": { name: "USDTCOP", pricePair: "USDTCOP" },
        "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449": { name: "AAPL", pricePair: "AAPL" },
        "0xafd908D358315efDBA493311AbE30648DEC4d2dE": { name: "META", pricePair: "META" },
        "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb": { name: "USDTNGN", pricePair: "USDTNGN" },
    };

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║            POSITION SNAPSHOT - BEFORE CLOSING                    ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    const [signer] = await ethers.getSigners();

    // Fetch prices
    async function fetchPrice(pricePair) {
        const PRICE_SERVER = "https://marks-server-a58cc19eb539.herokuapp.com";
        try {
            const response = await axios.get(`${PRICE_SERVER}/api/v1/price/current/${pricePair}`, { timeout: 5000 });
            return response.data?.price || null;
        } catch (error) {
            return null;
        }
    }

    console.log(`📊 Fetching current prices...`);
    const priceCache = {};
    for (const [addr, info] of Object.entries(MARKETS)) {
        const price = await fetchPrice(info.pricePair);
        if (price) {
            priceCache[addr.toLowerCase()] = price;
            console.log(`   ✅ ${info.name}: $${price}`);
        }
    }

    // Get position info
    const reader = await ethers.getContractAt("Reader", ADDRESSES.READER);
    const allMarkets = Object.keys(MARKETS);
    const marketPricesPayload = allMarkets.map(addr => {
        const price = priceCache[addr.toLowerCase()];
        const indexPrice = price ? ethers.utils.parseUnits(price.toFixed(12), 12) : ethers.utils.parseUnits("1", 12);
        const stablePrice = ethers.utils.parseUnits("1", 24);

        return {
            indexTokenPrice: { min: indexPrice, max: indexPrice },
            longTokenPrice: { min: stablePrice, max: stablePrice },
            shortTokenPrice: { min: stablePrice, max: stablePrice },
        };
    });

    console.log(`\n🔍 Fetching position data...`);
    const positionInfoList = await reader.getAccountPositionInfoList(
        ADDRESSES.DATA_STORE,
        ADDRESSES.REFERRAL_STORAGE,
        ACCOUNT_ADDRESS,
        allMarkets,
        marketPricesPayload,
        ethers.constants.AddressZero,
        0,
        1000
    );

    console.log(`✅ Found ${positionInfoList.length} positions\n`);
    console.log("═".repeat(70));

    const snapshots = [];

    for (const posInfo of positionInfoList) {
        const { position, fees, basePnlUsd } = posInfo;
        const { addresses, numbers, flags } = position;

        if (numbers.sizeInUsd.eq(0)) continue;

        // Skip if filtering by market and this isn't it
        if (MARKET_ADDRESS && addresses.market.toLowerCase() !== MARKET_ADDRESS.toLowerCase()) {
            continue;
        }

        const marketInfo = MARKETS[addresses.market.toLowerCase()];
        const currentPrice = priceCache[addresses.market.toLowerCase()];

        // Calculate all values
        const sizeInUsd = parseFloat(ethers.utils.formatUnits(numbers.sizeInUsd, 30));
        const sizeInTokens = parseFloat(ethers.utils.formatUnits(numbers.sizeInTokens, 18));
        const collateralAmount = parseFloat(ethers.utils.formatUnits(numbers.collateralAmount, 6));
        const basePnl = parseFloat(ethers.utils.formatUnits(basePnlUsd, 30));

        const borrowingFee = parseFloat(ethers.utils.formatUnits(fees.borrowing.borrowingFeeUsd, 30));
        const fundingFee = parseFloat(ethers.utils.formatUnits(fees.funding.fundingFeeAmount, 30));
        const positionFee = parseFloat(ethers.utils.formatUnits(fees.positionFeeAmount, 6));
        const totalCost = parseFloat(ethers.utils.formatUnits(fees.totalCostAmount, 30));

        const claimableLong = parseFloat(ethers.utils.formatUnits(fees.funding.claimableLongTokenAmount, 6));
        const claimableShort = parseFloat(ethers.utils.formatUnits(fees.funding.claimableShortTokenAmount, 6));

        const entryPrice = sizeInTokens > 0 ? sizeInUsd / sizeInTokens : 0;
        const leverage = collateralAmount > 0 ? sizeInUsd / collateralAmount : 0;

        console.log(`\n📍 ${marketInfo?.name || 'UNKNOWN'} ${flags.isLong ? 'LONG' : 'SHORT'} POSITION`);
        console.log("─".repeat(70));

        console.log(`\n💼 Position Details:`);
        console.log(`   Market: ${addresses.market}`);
        console.log(`   Collateral Token: ${addresses.collateralToken}`);
        console.log(`   Size (USD): $${sizeInUsd.toFixed(2)}`);
        console.log(`   Size (Tokens): ${sizeInTokens.toFixed(6)}`);
        console.log(`   Collateral: ${collateralAmount.toFixed(2)} mUSD`);
        console.log(`   Leverage: ${leverage.toFixed(2)}x`);
        console.log(`   Entry Price: $${entryPrice.toFixed(6)}`);
        console.log(`   Current Price: $${currentPrice}`);

        console.log(`\n💰 PnL & Fees:`);
        console.log(`   Base PnL: ${basePnl >= 0 ? '+' : ''}$${basePnl.toFixed(2)}`);
        console.log(`   Borrowing Fee: -$${borrowingFee.toFixed(2)}`);
        console.log(`   Funding Fee: ${fundingFee >= 0 ? '-' : '+'}$${Math.abs(fundingFee).toFixed(2)}`);
        console.log(`   Position Fee: -$${positionFee.toFixed(2)}`);
        console.log(`   Total Fees: -$${totalCost.toFixed(2)}`);

        console.log(`\n🎁 Claimable Funding:`);
        console.log(`   Long Token: ${claimableLong.toFixed(6)} mUSD`);
        console.log(`   Short Token: ${claimableShort.toFixed(6)} mUSD`);
        console.log(`   Total Claimable: ${(claimableLong + claimableShort).toFixed(6)} mUSD`);

        // CALCULATE EXPECTED PAYOUT
        const netPnl = basePnl - totalCost;
        const expectedPayout = collateralAmount + netPnl + claimableLong + claimableShort;

        console.log(`\n💵 EXPECTED PAYOUT CALCULATION:`);
        console.log(`   ─────────────────────────────────────────────────`);
        console.log(`   Collateral:           ${collateralAmount.toFixed(2)} mUSD`);
        console.log(`   + Base PnL:           ${basePnl >= 0 ? '+' : ''}${basePnl.toFixed(2)} mUSD`);
        console.log(`   - Total Fees:         -${totalCost.toFixed(2)} mUSD`);
        console.log(`   + Claimable Funding:  +${(claimableLong + claimableShort).toFixed(2)} mUSD`);
        console.log(`   ─────────────────────────────────────────────────`);
        console.log(`   = EXPECTED PAYOUT:    ${expectedPayout.toFixed(2)} mUSD`);
        console.log(`   ─────────────────────────────────────────────────`);

        // Save snapshot
        const snapshot = {
            timestamp: new Date().toISOString(),
            account: ACCOUNT_ADDRESS,
            market: addresses.market,
            marketName: marketInfo?.name || 'UNKNOWN',
            isLong: flags.isLong,
            position: {
                sizeInUsd,
                sizeInTokens,
                collateralAmount,
                leverage,
                entryPrice,
                currentPrice,
            },
            pnl: {
                basePnl,
                borrowingFee,
                fundingFee,
                positionFee,
                totalCost,
                netPnl,
            },
            claimable: {
                longToken: claimableLong,
                shortToken: claimableShort,
                total: claimableLong + claimableShort,
            },
            expectedPayout,
        };

        snapshots.push(snapshot);

        console.log(`\n✅ Snapshot saved!`);
        console.log("═".repeat(70));
    }

    // Save to file
    if (snapshots.length > 0) {
        const snapshotDir = path.join(__dirname, 'snapshots');
        if (!fs.existsSync(snapshotDir)) {
            fs.mkdirSync(snapshotDir, { recursive: true });
        }

        const filename = `position-snapshot-${Date.now()}.json`;
        const filepath = path.join(snapshotDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(snapshots, null, 2));

        console.log(`\n📁 Snapshot saved to: ${filepath}`);
        console.log(`\n📋 NEXT STEPS:`);
        console.log(`   1. Close your position now`);
        console.log(`   2. Note the transaction hash`);
        console.log(`   3. Check your wallet balance to see actual amount received`);
        console.log(`   4. Compare actual vs expected payout (${snapshots[0].expectedPayout.toFixed(2)} mUSD)`);
        console.log(`\n   If there's a discrepancy, investigate:`);
        console.log(`   - Price impact during execution`);
        console.log(`   - Execution fee paid to keeper`);
        console.log(`   - Price slippage between snapshot and execution`);
    } else {
        console.log(`\n⚠️  No positions found to snapshot`);
    }

    console.log("\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
