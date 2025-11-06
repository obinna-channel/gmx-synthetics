const { ethers } = require("hardhat");

/**
 * Complete Breakdown of Position Close
 * Shows ALL components of Total Impact and Total Fees
 */

async function main() {
    const TX_HASH = "0x1420d06b5ab4c564af39d5dc7463212acfb3de879db631899bcf263dfd2a1788"; // Pos 3 - mCOP LONG
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const EVENT_LOG1_SIG = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         COMPLETE BREAKDOWN: TOTAL IMPACT & TOTAL FEES            ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    console.log(`📋 Transaction: ${TX_HASH}\n`);

    // Get transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
    if (!receipt) {
        console.log("❌ Transaction not found!");
        return;
    }

    console.log(`✅ Transaction found in block ${receipt.blockNumber}\n`);

    // Query all EventLog1 events from this transaction
    const filter = {
        address: EVENT_EMITTER,
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
        topics: [EVENT_LOG1_SIG]
    };

    const logs = await ethers.provider.getLogs(filter);
    const txLogs = logs.filter(log => log.transactionHash === TX_HASH);

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    // Helper function
    function getValueFromItems(items, key) {
        if (!items || !items.items) return null;
        for (const item of items.items) {
            if (item.key === key) {
                return item.value;
            }
        }
        return null;
    }

    let positionDecreaseData = null;
    let positionFeesData = null;

    // Parse events
    for (const log of txLogs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventName = parsed.args[1];
            const eventData = parsed.args[4];

            if (eventName === "PositionDecrease") {
                const intItems = eventData.intItems;
                positionDecreaseData = {
                    priceImpactUsd: intItems.items[0].value,
                    basePnlUsd: intItems.items[1].value,
                    proportionalPendingImpactUsd: intItems.items[3].value,
                    totalImpactUsd: intItems.items[4].value,
                };
            }

            if (eventName === "PositionFeesCollected") {
                positionFeesData = {
                    // Funding
                    fundingFeeAmount: getValueFromItems(eventData.uintItems, 'fundingFeeAmount'),

                    // Borrowing
                    borrowingFeeUsd: getValueFromItems(eventData.uintItems, 'borrowingFeeUsd'),
                    borrowingFeeAmount: getValueFromItems(eventData.uintItems, 'borrowingFeeAmount'),
                    borrowingFeeAmountForFeeReceiver: getValueFromItems(eventData.uintItems, 'borrowingFeeAmountForFeeReceiver'),

                    // Position Fee
                    positionFeeAmount: getValueFromItems(eventData.uintItems, 'positionFeeAmount'),
                    positionFeeAmountForPool: getValueFromItems(eventData.uintItems, 'positionFeeAmountForPool'),

                    // Protocol & Distribution
                    protocolFeeAmount: getValueFromItems(eventData.uintItems, 'protocolFeeAmount'),
                    feeReceiverAmount: getValueFromItems(eventData.uintItems, 'feeReceiverAmount'),
                    feeAmountForPool: getValueFromItems(eventData.uintItems, 'feeAmountForPool'),

                    // UI Fee
                    uiFeeAmount: getValueFromItems(eventData.uintItems, 'uiFeeAmount'),

                    // Discounts/Rebates
                    totalRebateAmount: getValueFromItems(eventData.uintItems, 'referral.totalRebateAmount'),
                    traderDiscountAmount: getValueFromItems(eventData.uintItems, 'referral.traderDiscountAmount'),
                    affiliateRewardAmount: getValueFromItems(eventData.uintItems, 'referral.affiliateRewardAmount'),
                    proTraderDiscountAmount: getValueFromItems(eventData.uintItems, 'pro.traderDiscountAmount'),

                    // Liquidation (if any)
                    liquidationFeeAmount: getValueFromItems(eventData.uintItems, 'liquidationFeeAmount'),

                    // Total
                    totalCostAmount: getValueFromItems(eventData.uintItems, 'totalCostAmount'),
                };
            }
        } catch (error) {
            // Skip unparseable events
        }
    }

    if (!positionDecreaseData || !positionFeesData) {
        console.log("❌ Could not find required events!");
        return;
    }

    // ===== DISPLAY TOTAL IMPACT BREAKDOWN =====
    console.log("═".repeat(70));
    console.log("\n📊 TOTAL IMPACT BREAKDOWN\n");
    console.log("═".repeat(70));

    const priceImpact = parseFloat(ethers.utils.formatUnits(positionDecreaseData.priceImpactUsd, 30));
    const pendingImpact = parseFloat(ethers.utils.formatUnits(positionDecreaseData.proportionalPendingImpactUsd, 30));
    const totalImpact = parseFloat(ethers.utils.formatUnits(positionDecreaseData.totalImpactUsd, 30));

    console.log(`\n1. Price Impact:                    ${priceImpact >= 0 ? '+' : ''}${priceImpact.toFixed(6)} USD`);
    console.log(`2. Proportional Pending Impact:     ${pendingImpact >= 0 ? '+' : ''}${pendingImpact.toFixed(6)} USD`);
    console.log(`   ─────────────────────────────────────────────────────────────`);
    console.log(`   = TOTAL IMPACT:                  ${totalImpact >= 0 ? '+' : ''}${totalImpact.toFixed(6)} USD`);

    console.log(`\n✅ Calculation check: ${priceImpact.toFixed(6)} + ${pendingImpact.toFixed(6)} = ${(priceImpact + pendingImpact).toFixed(6)}`);
    console.log(`   Actual totalImpactUsd from event: ${totalImpact.toFixed(6)}`);
    console.log(`   Match: ${Math.abs((priceImpact + pendingImpact) - totalImpact) < 0.01 ? '✅ YES' : '❌ NO'}`);

    // ===== DISPLAY TOTAL FEES BREAKDOWN =====
    console.log("\n\n" + "═".repeat(70));
    console.log("\n💰 TOTAL FEES (totalCostAmount) BREAKDOWN\n");
    console.log("═".repeat(70));

    // fundingFeeAmount is in token units (6 decimals), NOT USD (30 decimals)!
    const fundingFee = parseFloat(ethers.utils.formatUnits(positionFeesData.fundingFeeAmount || 0, 6));
    const borrowingFee = parseFloat(ethers.utils.formatUnits(positionFeesData.borrowingFeeAmount || 0, 6));
    const positionFee = parseFloat(ethers.utils.formatUnits(positionFeesData.positionFeeAmount || 0, 6));
    const uiFee = parseFloat(ethers.utils.formatUnits(positionFeesData.uiFeeAmount || 0, 6));
    const liquidationFee = parseFloat(ethers.utils.formatUnits(positionFeesData.liquidationFeeAmount || 0, 6));
    const traderDiscount = parseFloat(ethers.utils.formatUnits(positionFeesData.traderDiscountAmount || 0, 6));
    const proDiscount = parseFloat(ethers.utils.formatUnits(positionFeesData.proTraderDiscountAmount || 0, 6));
    const totalCost6 = parseFloat(ethers.utils.formatUnits(positionFeesData.totalCostAmount || 0, 6));
    const totalCost30 = parseFloat(ethers.utils.formatUnits(positionFeesData.totalCostAmount || 0, 30));

    console.log(`\nDEBUG: Raw values from event:`);
    console.log(`  fundingFeeAmount (raw):         ${positionFeesData.fundingFeeAmount}`);
    console.log(`  borrowingFeeAmount (raw):       ${positionFeesData.borrowingFeeAmount}`);
    console.log(`  positionFeeAmount (raw):        ${positionFeesData.positionFeeAmount}`);
    console.log(`  uiFeeAmount (raw):              ${positionFeesData.uiFeeAmount}`);
    console.log(`  liquidationFeeAmount (raw):     ${positionFeesData.liquidationFeeAmount}`);
    console.log(`  totalCostAmount (raw):          ${positionFeesData.totalCostAmount}`);
    console.log(`  protocolFeeAmount (raw):        ${positionFeesData.protocolFeeAmount}`);
    console.log(`  feeReceiverAmount (raw):        ${positionFeesData.feeReceiverAmount}`);
    console.log(`  feeAmountForPool (raw):         ${positionFeesData.feeAmountForPool}`);

    const totalCost = totalCost6;

    // Convert funding fee from USD (30 decimals) to tokens (6 decimals) - assume 1:1 for mUSD
    const fundingFeeInTokens = fundingFee;

    console.log(`\nFormula: totalCostAmount = positionFeeAmount + borrowingFeeAmount + liquidationFeeAmount + uiFeeAmount + fundingFeeAmount - totalDiscountAmount\n`);

    console.log(`1. Position Fee:                      +${positionFee.toFixed(6)} mUSD`);
    console.log(`2. Borrowing Fee:                     +${borrowingFee.toFixed(6)} mUSD`);
    console.log(`3. Liquidation Fee:                   +${liquidationFee.toFixed(6)} mUSD`);
    console.log(`4. UI Fee:                            +${uiFee.toFixed(6)} mUSD`);
    console.log(`5. Funding Fee:                       +${fundingFee.toFixed(6)} mUSD`);
    console.log(`6. Trader Discount (referral):        -${traderDiscount.toFixed(6)} mUSD`);
    console.log(`7. Pro Trader Discount:               -${proDiscount.toFixed(6)} mUSD`);

    const maxDiscount = Math.max(traderDiscount, proDiscount);
    console.log(`\n   Note: totalDiscountAmount = max(traderDiscount, proDiscount) = ${maxDiscount.toFixed(6)} mUSD`);

    console.log(`   ─────────────────────────────────────────────────────────────`);
    const calculatedTotal = positionFee + borrowingFee + liquidationFee + uiFee + fundingFee - maxDiscount;
    console.log(`   = CALCULATED TOTAL:                ${calculatedTotal.toFixed(6)} mUSD`);
    console.log(`   = ACTUAL totalCostAmount:          ${totalCost.toFixed(6)} mUSD`);

    const diff = Math.abs(calculatedTotal - totalCost);
    console.log(`\n✅ Calculation check:`);
    console.log(`   Difference: ${diff.toFixed(6)} mUSD`);
    console.log(`   Match: ${diff < 0.01 ? '✅ YES' : '❌ NO'}`);

    // ===== ADDITIONAL FEE DETAILS =====
    console.log("\n\n" + "═".repeat(70));
    console.log("\n📋 ADDITIONAL FEE BREAKDOWN (How fees are distributed)\n");
    console.log("═".repeat(70));

    const protocolFee = parseFloat(ethers.utils.formatUnits(positionFeesData.protocolFeeAmount || 0, 6));
    const feeReceiver = parseFloat(ethers.utils.formatUnits(positionFeesData.feeReceiverAmount || 0, 6));
    const feeForPool = parseFloat(ethers.utils.formatUnits(positionFeesData.feeAmountForPool || 0, 6));
    const positionFeeForPool = parseFloat(ethers.utils.formatUnits(positionFeesData.positionFeeAmountForPool || 0, 6));
    const borrowingForReceiver = parseFloat(ethers.utils.formatUnits(positionFeesData.borrowingFeeAmountForFeeReceiver || 0, 6));
    const affiliateReward = parseFloat(ethers.utils.formatUnits(positionFeesData.affiliateRewardAmount || 0, 6));

    console.log(`\nPosition Fee Distribution (${positionFee.toFixed(2)} mUSD total):`);
    console.log(`  - Protocol Fee:                     ${protocolFee.toFixed(6)} mUSD`);
    console.log(`  - Fee Receiver:                     ${feeReceiver.toFixed(6)} mUSD`);
    console.log(`  - Position Fee for Pool:            ${positionFeeForPool.toFixed(6)} mUSD`);
    console.log(`  - Affiliate Reward:                 ${affiliateReward.toFixed(6)} mUSD`);

    console.log(`\nBorrowing Fee Distribution (${borrowingFee.toFixed(2)} mUSD total):`);
    console.log(`  - To Fee Receiver:                  ${borrowingForReceiver.toFixed(6)} mUSD`);
    console.log(`  - To Pool:                          ${(borrowingFee - borrowingForReceiver).toFixed(6)} mUSD`);

    console.log(`\nTotal Fees Going to Pool:             ${feeForPool.toFixed(6)} mUSD`);

    console.log("\n" + "═".repeat(70));
    console.log("✅ Breakdown complete!");
    console.log("═".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
