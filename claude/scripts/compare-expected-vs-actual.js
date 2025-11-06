const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Compare Expected vs Actual Payout Script
 *
 * This script compares:
 * - Expected payout (from snapshot taken before closing)
 * - Actual payout (from transaction events)
 *
 * Usage:
 * 1. First run: snapshot-position-before-close.js
 * 2. Close your position
 * 3. Run this script: npx hardhat run claude/scripts/compare-expected-vs-actual.js --network arbitrumSepolia
 */

async function main() {
    // ============ CONFIGURATION ============
    const TX_HASH = "0xYOUR_CLOSE_TRANSACTION_HASH_HERE"; // <-- UPDATE THIS
    const SNAPSHOT_FILE = ""; // Optional: specify snapshot file, otherwise uses latest

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║          EXPECTED VS ACTUAL PAYOUT RECONCILIATION                ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    // ============ LOAD SNAPSHOT ============
    console.log("📂 Loading position snapshot...");

    const snapshotDir = path.join(__dirname, 'snapshots');
    let snapshot = null;

    if (SNAPSHOT_FILE) {
        const filepath = path.join(snapshotDir, SNAPSHOT_FILE);
        if (fs.existsSync(filepath)) {
            const data = fs.readFileSync(filepath, 'utf8');
            const snapshots = JSON.parse(data);
            snapshot = snapshots[0]; // Take first position
        }
    } else {
        // Load most recent snapshot
        if (fs.existsSync(snapshotDir)) {
            const files = fs.readdirSync(snapshotDir)
                .filter(f => f.startsWith('position-snapshot-'))
                .sort()
                .reverse();

            if (files.length > 0) {
                const filepath = path.join(snapshotDir, files[0]);
                const data = fs.readFileSync(filepath, 'utf8');
                const snapshots = JSON.parse(data);
                snapshot = snapshots[0];
                console.log(`✅ Loaded snapshot: ${files[0]}`);
            }
        }
    }

    if (!snapshot) {
        console.log("❌ No snapshot found!");
        console.log("\nPlease run snapshot-position-before-close.js BEFORE closing the position");
        return;
    }

    console.log(`\n📋 Snapshot Details:`);
    console.log(`   Timestamp: ${snapshot.timestamp}`);
    console.log(`   Market: ${snapshot.marketName} ${snapshot.isLong ? 'LONG' : 'SHORT'}`);
    console.log(`   Expected Payout: ${snapshot.expectedPayout.toFixed(2)} mUSD`);

    // ============ GET TRANSACTION ============
    console.log("\n\n💸 Analyzing transaction...");

    let receipt;
    try {
        receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
        console.log(`✅ Transaction found: ${TX_HASH}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(`\nPlease update TX_HASH at the top of the script`);
        return;
    }

    // ============ EXTRACT TRANSFERS ============
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const TRANSFER_SIG = ethers.utils.id("Transfer(address,address,uint256)");

    let totalReceived = ethers.BigNumber.from(0);
    const transfers = [];

    for (const log of receipt.logs) {
        if (log.topics[0] === TRANSFER_SIG &&
            log.address.toLowerCase() === mUSD.toLowerCase()) {

            const from = '0x' + log.topics[1].slice(-40);
            const to = '0x' + log.topics[2].slice(-40);
            const amount = ethers.BigNumber.from(log.data);

            // Check if transfer TO user
            if (to.toLowerCase() === snapshot.account.toLowerCase()) {
                totalReceived = totalReceived.add(amount);
                transfers.push({
                    from,
                    to,
                    amount: parseFloat(ethers.utils.formatUnits(amount, 6)),
                });
            }
        }
    }

    const actualPayout = parseFloat(ethers.utils.formatUnits(totalReceived, 6));

    console.log(`\n📊 Transfers to user:`);
    if (transfers.length === 0) {
        console.log(`   ❌ No transfers found!`);
    } else {
        transfers.forEach((t, i) => {
            console.log(`   ${i + 1}. ${t.amount.toFixed(6)} mUSD from ${t.from.slice(0, 10)}...`);
        });
    }
    console.log(`\n   Total Received: ${actualPayout.toFixed(2)} mUSD`);

    // ============ RECONCILIATION ============
    console.log("\n\n" + "═".repeat(70));
    console.log("💰 RECONCILIATION");
    console.log("═".repeat(70));

    const expected = snapshot.expectedPayout;
    const actual = actualPayout;
    const difference = actual - expected;
    const percentDiff = expected > 0 ? (difference / expected) * 100 : 0;

    console.log(`\n   Expected Payout:  ${expected.toFixed(2)} mUSD`);
    console.log(`   Actual Payout:    ${actual.toFixed(2)} mUSD`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Difference:       ${difference >= 0 ? '+' : ''}${difference.toFixed(2)} mUSD (${percentDiff >= 0 ? '+' : ''}${percentDiff.toFixed(2)}%)`);

    // Analysis
    console.log("\n\n📊 ANALYSIS");
    console.log("─".repeat(70));

    if (Math.abs(difference) < 0.01) {
        console.log(`\n✅ PERFECT MATCH! (within $0.01)`);
        console.log(`   The expected and actual payouts match closely.`);
    } else if (difference < 0) {
        console.log(`\n⚠️  RECEIVED LESS THAN EXPECTED`);
        console.log(`\n   Possible reasons for ${Math.abs(difference).toFixed(2)} mUSD shortfall:`);
        console.log(`   1. Price Impact: Large position caused unfavorable price movement`);
        console.log(`   2. Price Slippage: Market price moved between snapshot and execution`);
        console.log(`   3. Execution Fee: Keeper fee deducted (usually small)`);
        console.log(`   4. Additional Fees: Swap fees, price update fees`);
        console.log(`   5. Rounding: Small precision losses in calculations`);

        // Calculate impact percentages
        const priceImpactEstimate = Math.abs(difference);
        console.log(`\n   💡 If this was price impact: ~${((priceImpactEstimate / snapshot.position.collateralAmount) * 100).toFixed(2)}% of collateral`);
    } else {
        console.log(`\n🎉 RECEIVED MORE THAN EXPECTED!`);
        console.log(`\n   Possible reasons for ${difference.toFixed(2)} mUSD extra:`);
        console.log(`   1. Favorable Price Movement: Market moved in your favor`);
        console.log(`   2. Additional Claimable: More funding accumulated`);
        console.log(`   3. Fee Discount: Referral or UI fee discount applied`);
    }

    // Breakdown
    console.log("\n\n📝 EXPECTED PAYOUT BREAKDOWN");
    console.log("─".repeat(70));
    console.log(`   Initial Collateral:     ${snapshot.position.collateralAmount.toFixed(2)} mUSD`);
    console.log(`   + Base PnL:             ${snapshot.pnl.basePnl >= 0 ? '+' : ''}${snapshot.pnl.basePnl.toFixed(2)} mUSD`);
    console.log(`   - Borrowing Fee:        -${snapshot.pnl.borrowingFee.toFixed(2)} mUSD`);
    console.log(`   ${snapshot.pnl.fundingFee >= 0 ? '-' : '+'} Funding Fee:         ${snapshot.pnl.fundingFee >= 0 ? '-' : '+'}${Math.abs(snapshot.pnl.fundingFee).toFixed(2)} mUSD`);
    console.log(`   - Position Fee:         -${snapshot.pnl.positionFee.toFixed(2)} mUSD`);
    console.log(`   + Claimable Funding:    +${snapshot.claimable.total.toFixed(2)} mUSD`);
    console.log(`   ─────────────────────────────────────────`);
    console.log(`   = Expected:             ${expected.toFixed(2)} mUSD`);
    console.log(`   = Actual:               ${actual.toFixed(2)} mUSD`);
    console.log(`   = Unaccounted:          ${difference >= 0 ? '+' : ''}${difference.toFixed(2)} mUSD`);

    // Recommendations
    console.log("\n\n🔧 NEXT STEPS");
    console.log("─".repeat(70));

    if (Math.abs(difference) < 0.01) {
        console.log(`\n✅ No action needed - reconciliation successful!`);
    } else if (Math.abs(difference) < 1) {
        console.log(`\n✅ Small difference (< $1) - likely due to rounding or execution fees`);
    } else if (Math.abs(percentDiff) < 2) {
        console.log(`\n⚠️  Moderate difference (< 2%) - likely price impact or slippage`);
        console.log(`   Consider: Checking pool liquidity before closing large positions`);
    } else {
        console.log(`\n🚨 LARGE DISCREPANCY (> 2%)`);
        console.log(`\n   Recommended debugging steps:`);
        console.log(`   1. Check transaction events in block explorer`);
        console.log(`   2. Look for PositionFeesCollected event for fee breakdown`);
        console.log(`   3. Check PositionDecrease event for actual amounts`);
        console.log(`   4. Verify market liquidity at time of execution`);
        console.log(`   5. Check if there were any oracle price updates during execution`);
        console.log(`\n   Transaction: ${TX_HASH}`);
    }

    console.log("\n\n" + "═".repeat(70));
    console.log("✅ Reconciliation complete!");
    console.log("═".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
