const { ethers } = require("hardhat");

/**
 * Complete Reconciliation from Transaction Events
 *
 * This script extracts ALL data from the transaction events:
 * - PositionDecrease: PnL, collateral changes, price impact
 * - PositionFeesCollected: All fees including claimable funding
 * - Transfer: Actual amount sent to user
 *
 * Then calculates: Expected = Collateral + PnL - Fees + Claimable
 * And compares with: Actual = Transfer amount
 *
 * NO SNAPSHOT NEEDED! Just provide the transaction hash.
 *
 * Usage:
 * npx hardhat run claude/scripts/reconcile-from-events.js --network arbitrumSepolia
 */

async function main() {
    // ============ CONFIGURATION ============
    const TX_HASH = "0x1420d06b5ab4c564af39d5dc7463212acfb3de879db631899bcf263dfd2a1788"; // Pos 3 - mCOP LONG

    const ADDRESSES = {
        EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C",
        mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    };

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         COMPLETE RECONCILIATION FROM TRANSACTION EVENTS          ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    // ============ GET TRANSACTION ============
    console.log("📋 Step 1: Fetching transaction...");
    console.log("─".repeat(70));

    let receipt, tx;
    try {
        receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
        tx = await ethers.provider.getTransaction(TX_HASH);

        console.log(`✅ Transaction found`);
        console.log(`   Hash: ${TX_HASH}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log(`\n💡 Update TX_HASH at the top of the script`);
        return;
    }

    // ============ PARSE POSITION DECREASE EVENT ============
    console.log("\n\n📉 Step 2: Parsing PositionDecrease event...");
    console.log("─".repeat(70));

    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);
    const eventEmitterInterface = eventEmitter.interface;

    let positionDecreaseData = null;
    let positionFeesData = null;
    let orderKey = null;

    for (const log of receipt.logs) {
        try {
            if (log.address.toLowerCase() === ADDRESSES.EVENT_EMITTER.toLowerCase()) {
                const parsed = eventEmitterInterface.parseLog(log);

                if (parsed.name === "EventLog1") {
                    // Access by numeric index (ethers.js doesn't provide named access for complex structs)
                    const eventName = parsed.args[1];      // string eventName
                    const eventData = parsed.args[4];      // EventLogData struct

                    // Parse PositionDecrease event
                    if (eventName === "PositionDecrease") {
                        const addressItems = eventData.addressItems;
                        const uintItems = eventData.uintItems;
                        const intItems = eventData.intItems;
                        const boolItems = eventData.boolItems;

                        positionDecreaseData = {
                            account: addressItems.items[0].value,
                            market: addressItems.items[1].value,
                            collateralToken: addressItems.items[2].value,
                            sizeInUsd: uintItems.items[0].value,
                            sizeInTokens: uintItems.items[1].value,
                            collateralAmount: uintItems.items[2].value,
                            executionPrice: uintItems.items[7].value,
                            sizeDeltaUsd: uintItems.items[12].value,
                            sizeDeltaInTokens: uintItems.items[13].value,
                            collateralDeltaAmount: uintItems.items[14].value,
                            priceImpactDiffUsd: uintItems.items[15].value, // IMPORTANT: Additional cost not in totalCostAmount!
                            priceImpactUsd: intItems.items[0].value,
                            basePnlUsd: intItems.items[1].value,
                            uncappedBasePnlUsd: intItems.items[2].value,
                            totalImpactUsd: intItems.items[4].value,
                            isLong: boolItems.items[0].value,
                        };

                        orderKey = parsed.args.topic1;

                        console.log(`✅ PositionDecrease event found`);
                        console.log(`   Account: ${positionDecreaseData.account}`);
                        console.log(`   Market: ${positionDecreaseData.market}`);
                        console.log(`   Size Delta: ${ethers.utils.formatUnits(positionDecreaseData.sizeDeltaUsd, 30)} USD`);
                        console.log(`   Collateral Delta: ${ethers.utils.formatUnits(positionDecreaseData.collateralDeltaAmount, 6)} mUSD`);
                        console.log(`   Base PnL: ${ethers.utils.formatUnits(positionDecreaseData.basePnlUsd, 30)} USD`);
                        console.log(`   Price Impact: ${ethers.utils.formatUnits(positionDecreaseData.priceImpactUsd, 30)} USD`);
                        console.log(`   Total Impact: ${ethers.utils.formatUnits(positionDecreaseData.totalImpactUsd, 30)} USD`);
                        console.log(`   Price Impact Diff: ${ethers.utils.formatUnits(positionDecreaseData.priceImpactDiffUsd, 30)} USD`);
                    }

                    // Parse PositionFeesCollected event using key-based lookup
                    if (eventName === "PositionFeesCollected") {
                        // Helper function to get value by key name
                        const getValueFromItems = (items, key) => {
                            if (!items || !items.items) return null;
                            for (const item of items.items) {
                                if (item.key === key) return item.value;
                            }
                            return null;
                        };

                        positionFeesData = {
                            // Basic fees
                            fundingFeeAmount: getValueFromItems(eventData.uintItems, 'fundingFeeAmount'),
                            claimableLongTokenAmount: getValueFromItems(eventData.uintItems, 'claimableLongTokenAmount'),
                            claimableShortTokenAmount: getValueFromItems(eventData.uintItems, 'claimableShortTokenAmount'),
                            borrowingFeeUsd: getValueFromItems(eventData.uintItems, 'borrowingFeeUsd'),
                            borrowingFeeAmount: getValueFromItems(eventData.uintItems, 'borrowingFeeAmount'),
                            positionFeeAmount: getValueFromItems(eventData.uintItems, 'positionFeeAmount'),
                            totalCostAmount: getValueFromItems(eventData.uintItems, 'totalCostAmount'),
                            uiFeeAmount: getValueFromItems(eventData.uintItems, 'uiFeeAmount'),

                            // Additional fee components that might affect totalCostAmount
                            protocolFeeAmount: getValueFromItems(eventData.uintItems, 'protocolFeeAmount'),
                            feeReceiverAmount: getValueFromItems(eventData.uintItems, 'feeReceiverAmount'),
                            feeAmountForPool: getValueFromItems(eventData.uintItems, 'feeAmountForPool'),
                            positionFeeAmountForPool: getValueFromItems(eventData.uintItems, 'positionFeeAmountForPool'),
                            borrowingFeeAmountForFeeReceiver: getValueFromItems(eventData.uintItems, 'borrowingFeeAmountForFeeReceiver'),

                            // Referral/discount amounts (can reduce fees)
                            totalRebateAmount: getValueFromItems(eventData.uintItems, 'referral.totalRebateAmount'),
                            traderDiscountAmount: getValueFromItems(eventData.uintItems, 'referral.traderDiscountAmount'),
                            affiliateRewardAmount: getValueFromItems(eventData.uintItems, 'referral.affiliateRewardAmount'),
                        };

                        console.log(`\n✅ PositionFeesCollected event found`);
                        console.log(`   Funding Fee: ${ethers.utils.formatUnits(positionFeesData.fundingFeeAmount, 30)} USD`);
                        console.log(`   Claimable Long: ${ethers.utils.formatUnits(positionFeesData.claimableLongTokenAmount, 6)} mUSD`);
                        console.log(`   Claimable Short: ${ethers.utils.formatUnits(positionFeesData.claimableShortTokenAmount, 6)} mUSD`);
                        console.log(`   Borrowing Fee: ${ethers.utils.formatUnits(positionFeesData.borrowingFeeUsd, 30)} USD`);
                        console.log(`   Position Fee: ${ethers.utils.formatUnits(positionFeesData.positionFeeAmount, 6)} mUSD`);
                        console.log(`   Total Cost: ${ethers.utils.formatUnits(positionFeesData.totalCostAmount, 30)} USD`);
                    }
                }
            }
        } catch (error) {
            // Skip unparseable logs
        }
    }

    if (!positionDecreaseData || !positionFeesData) {
        console.log(`\n❌ Could not find PositionDecrease or PositionFeesCollected events`);
        console.log(`\n   This transaction may not be a position decrease/close`);
        console.log(`   Or the events may be in a different format`);
        return;
    }

    // ============ EXTRACT TRANSFERS ============
    console.log("\n\n💸 Step 3: Extracting token transfers...");
    console.log("─".repeat(70));

    const TRANSFER_SIG = ethers.utils.id("Transfer(address,address,uint256)");
    let totalTransferred = ethers.BigNumber.from(0);
    const transfers = [];

    for (const log of receipt.logs) {
        if (log.topics[0] === TRANSFER_SIG &&
            log.address.toLowerCase() === ADDRESSES.mUSD.toLowerCase()) {

            const from = '0x' + log.topics[1].slice(-40);
            const to = '0x' + log.topics[2].slice(-40);
            const amount = ethers.BigNumber.from(log.data);

            // Track transfers TO the user
            if (to.toLowerCase() === positionDecreaseData.account.toLowerCase()) {
                totalTransferred = totalTransferred.add(amount);
                transfers.push({ from, to, amount });
                console.log(`✅ Transfer to user: ${ethers.utils.formatUnits(amount, 6)} mUSD`);
                console.log(`   From: ${from}`);
            }
        }
    }

    const actualPayout = parseFloat(ethers.utils.formatUnits(totalTransferred, 6));
    console.log(`\n📊 Total transferred to user: ${actualPayout.toFixed(6)} mUSD`);

    // ============ CALCULATE EXPECTED PAYOUT ============
    console.log("\n\n💰 Step 4: Calculating expected payout...");
    console.log("─".repeat(70));

    // Convert all values to human-readable format
    const collateralDelta = parseFloat(ethers.utils.formatUnits(positionDecreaseData.collateralDeltaAmount, 6));
    const basePnl = parseFloat(ethers.utils.formatUnits(positionDecreaseData.basePnlUsd, 30));
    const priceImpact = parseFloat(ethers.utils.formatUnits(positionDecreaseData.priceImpactUsd, 30));
    const totalImpact = parseFloat(ethers.utils.formatUnits(positionDecreaseData.totalImpactUsd, 30));
    const priceImpactDiff = parseFloat(ethers.utils.formatUnits(positionDecreaseData.priceImpactDiffUsd || 0, 30));

    // totalCostAmount is in collateral token units (6 decimals)
    const totalCost = parseFloat(ethers.utils.formatUnits(positionFeesData.totalCostAmount || 0, 6));
    const positionFee = parseFloat(ethers.utils.formatUnits(positionFeesData.positionFeeAmount || 0, 6));
    const borrowingFeeAmount = parseFloat(ethers.utils.formatUnits(positionFeesData.borrowingFeeAmount || 0, 6));
    const borrowingFeeUsd = parseFloat(ethers.utils.formatUnits(positionFeesData.borrowingFeeUsd || 0, 30));
    const fundingFee = parseFloat(ethers.utils.formatUnits(positionFeesData.fundingFeeAmount || 0, 30));
    const uiFee = parseFloat(ethers.utils.formatUnits(positionFeesData.uiFeeAmount || 0, 6));
    const protocolFee = parseFloat(ethers.utils.formatUnits(positionFeesData.protocolFeeAmount || 0, 6));
    const feeReceiverAmount = parseFloat(ethers.utils.formatUnits(positionFeesData.feeReceiverAmount || 0, 6));

    const claimableLong = parseFloat(ethers.utils.formatUnits(positionFeesData.claimableLongTokenAmount || 0, 6));
    const claimableShort = parseFloat(ethers.utils.formatUnits(positionFeesData.claimableShortTokenAmount || 0, 6));
    const totalClaimable = claimableLong + claimableShort;

    // Expected payout calculation
    // For a decrease: payout = collateralDelta + PnL + totalImpact - totalCost - priceImpactDiff
    // NOTE: Use TOTAL impact (not just priceImpact) as that's what's actually charged
    // NOTE: Claimable funding is NOT included (claimed separately)
    const expectedFromFormula = collateralDelta + basePnl + totalImpact - totalCost - priceImpactDiff;

    console.log(`\n📝 Calculation Breakdown:`);
    console.log(`   Collateral Delta:        ${collateralDelta >= 0 ? '+' : ''}${collateralDelta.toFixed(6)} mUSD`);
    console.log(`   + Base PnL:              ${basePnl >= 0 ? '+' : ''}${basePnl.toFixed(6)} USD`);
    console.log(`   + Total Impact:          ${totalImpact >= 0 ? '+' : ''}${totalImpact.toFixed(6)} USD`);
    console.log(`   - Total Fees:            -${totalCost.toFixed(6)} USD`);
    console.log(`   - Price Impact Diff:     -${priceImpactDiff.toFixed(6)} USD`);
    console.log(`   ─────────────────────────────────────────────────`);
    console.log(`   = Expected Payout:       ${expectedFromFormula.toFixed(6)} mUSD`);
    console.log(`\n   Note: Total Impact includes price impact + other market impacts`);
    console.log(`   * Claimable funding (${totalClaimable.toFixed(6)} mUSD) is claimed separately and NOT included above`);

    // ============ RECONCILIATION ============
    console.log("\n\n" + "═".repeat(70));
    console.log("💎 RECONCILIATION RESULT");
    console.log("═".repeat(70));

    const difference = actualPayout - expectedFromFormula;
    const percentDiff = expectedFromFormula > 0 ? (difference / expectedFromFormula) * 100 : 0;

    console.log(`\n   Expected (from events):  ${expectedFromFormula.toFixed(6)} mUSD`);
    console.log(`   Actual (from transfer):  ${actualPayout.toFixed(6)} mUSD`);
    console.log(`   ─────────────────────────────────────────────────`);
    console.log(`   Difference:              ${difference >= 0 ? '+' : ''}${difference.toFixed(6)} mUSD (${percentDiff >= 0 ? '+' : ''}${percentDiff.toFixed(3)}%)`);

    // ============ ANALYSIS ============
    console.log("\n\n📊 ANALYSIS");
    console.log("─".repeat(70));

    if (Math.abs(difference) < 0.01) {
        console.log(`\n✅ PERFECT RECONCILIATION!`);
        console.log(`   The expected and actual payouts match within $0.01`);
        console.log(`   All fees and PnL are accounted for correctly.`);
    } else if (Math.abs(difference) < 0.1) {
        console.log(`\n✅ GOOD RECONCILIATION (< $0.10 difference)`);
        console.log(`   Small difference likely due to rounding in calculations`);
    } else if (Math.abs(difference) < 1) {
        console.log(`\n⚠️  MINOR DISCREPANCY (< $1.00 difference)`);
        console.log(`   Possible causes:`);
        console.log(`   - Precision loss in decimal conversions`);
        console.log(`   - Small execution fees not captured in events`);
        console.log(`   - Gas refunds or rebates`);
    } else {
        console.log(`\n🚨 SIGNIFICANT DISCREPANCY (> $1.00)`);
        console.log(`\n   Difference: ${Math.abs(difference).toFixed(6)} mUSD`);
        console.log(`\n   Potential causes:`);

        if (difference < 0) {
            console.log(`   ❌ User received LESS than expected:`);
            console.log(`      - Additional execution fees not in events`);
            console.log(`      - Keeper gas reimbursement`);
            console.log(`      - Hidden swap fees`);
            console.log(`      - Bug in contract or event emission`);
        } else {
            console.log(`   ✅ User received MORE than expected:`);
            console.log(`      - Fee rebates or discounts applied`);
            console.log(`      - Referral rewards`);
            console.log(`      - Multiple transfers combined`);
            console.log(`      - Previous pending claims included`);
        }

        console.log(`\n   🔍 Debug steps:`);
        console.log(`      1. Check transaction in block explorer for all events`);
        console.log(`      2. Verify Transfer events - might be multiple transfers`);
        console.log(`      3. Check for additional fee events`);
        console.log(`      4. Review contract code for hidden deductions`);
    }

    // ============ DETAILED BREAKDOWN ============
    console.log("\n\n📋 DETAILED FEE BREAKDOWN");
    console.log("─".repeat(70));

    console.log(`\n   Fee Component Breakdown:`);
    console.log(`   - Position Fee:          ${positionFee.toFixed(6)} mUSD`);
    console.log(`   - Borrowing Fee Amount:  ${borrowingFeeAmount.toFixed(6)} mUSD`);
    console.log(`   - Borrowing Fee USD:     ${borrowingFeeUsd.toFixed(6)} USD`);
    console.log(`   - Funding Fee:           ${fundingFee.toFixed(6)} USD`);
    console.log(`   - UI Fee:                ${uiFee.toFixed(6)} mUSD`);
    console.log(`   - Protocol Fee:          ${protocolFee.toFixed(6)} mUSD`);
    console.log(`   - Fee Receiver Amount:   ${feeReceiverAmount.toFixed(6)} mUSD`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Total Cost Amount:       ${totalCost.toFixed(6)} mUSD`);

    console.log(`\n   PnL Breakdown:`);
    console.log(`   - Base PnL:         ${basePnl.toFixed(6)} USD`);
    console.log(`   - Price Impact:     ${priceImpact.toFixed(6)} USD`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Net PnL Impact:     ${(basePnl + priceImpact).toFixed(6)} USD`);

    console.log(`\n   Funding Summary:`);
    console.log(`   - Claimable Long:   ${claimableLong.toFixed(6)} mUSD`);
    console.log(`   - Claimable Short:  ${claimableShort.toFixed(6)} mUSD`);
    console.log(`   ─────────────────────────────────────`);
    console.log(`   Total Claimable:    ${totalClaimable.toFixed(6)} mUSD`);

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
