const { ethers } = require("hardhat");

/**
 * Check Actual Claim Amounts
 *
 * When claimableLongTokenAmount = 20.20 and claimableShortTokenAmount = 20.20
 * and both tokens are mUSD, do we get 20.20 or 40.40?
 */

async function main() {
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const mUSD_ADDRESS = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    // The position close that generated 20.20 L + 20.20 S claimable
    const POSITION_CLOSE_TX = "0xd1413b90602f73ae95da15eba94c2a1b7ae3f0fdb0be71f6fa81dd8a6e83f41f";
    const POSITION_CLOSE_BLOCK = 209451690;

    // The claim that happened after
    const CLAIM_TX = "0x1162f2d20e15e5017bd98eaa2fa6a3ae2a2a33f6b89f30f2e804c06b9c15d29e";
    const CLAIM_BLOCK = 209454294;

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         CHECK ACTUAL CLAIM AMOUNTS                               ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    console.log(`Scenario: Position close shows claimable 20.20 L + 20.20 S (both mUSD)`);
    console.log(`Question: When claimed, does user get 20.20 or 40.40?\n`);

    const eventEmitter = await ethers.getContractAt("EventEmitter", "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C");
    const eventLog1Topic0 = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    function getValueFromItems(items, key) {
        if (!items || !items.items) return null;
        for (const item of items.items) {
            if (item.key === key) {
                return item.value;
            }
        }
        return null;
    }

    // ========================================================================
    // STEP 1: Check what the position close said was claimable
    // ========================================================================
    console.log(`${'═'.repeat(100)}`);
    console.log(`STEP 1: Position Close Transaction Analysis`);
    console.log(`${'═'.repeat(100)}\n`);

    const posCloseReceipt = await ethers.provider.getTransactionReceipt(POSITION_CLOSE_TX);
    console.log(`Transaction: ${POSITION_CLOSE_TX}`);
    console.log(`Block: ${POSITION_CLOSE_BLOCK}\n`);

    const positionFeesHash = ethers.utils.id("PositionFeesCollected");

    for (const log of posCloseReceipt.logs) {
        if (log.topics[0] === eventLog1Topic0 && log.topics[1] === positionFeesHash) {
            try {
                const parsed = eventEmitter.interface.parseLog(log);
                const eventData = parsed.args[4];

                const claimableLong = getValueFromItems(eventData.uintItems, 'claimableLongTokenAmount');
                const claimableShort = getValueFromItems(eventData.uintItems, 'claimableShortTokenAmount');

                console.log(`PositionFeesCollected Event:`);
                console.log(`  Claimable Long Token Amount: ${ethers.utils.formatUnits(claimableLong, 6)} mUSD`);
                console.log(`  Claimable Short Token Amount: ${ethers.utils.formatUnits(claimableShort, 6)} mUSD`);
                console.log(`  Sum: ${parseFloat(ethers.utils.formatUnits(claimableLong, 6)) + parseFloat(ethers.utils.formatUnits(claimableShort, 6))} mUSD\n`);
            } catch (error) {
                // Skip
            }
        }
    }

    // Check for ClaimableFundingUpdated events in the same transaction
    const claimableFundingUpdatedHash = ethers.utils.id("ClaimableFundingUpdated");

    console.log(`ClaimableFundingUpdated Events in same transaction:`);
    let updateCount = 0;
    for (const log of posCloseReceipt.logs) {
        if (log.topics[0] === eventLog1Topic0 && log.topics[1] === claimableFundingUpdatedHash) {
            try {
                const parsed = eventEmitter.interface.parseLog(log);
                const eventData = parsed.args[4];

                const token = getValueFromItems(eventData.addressItems, 'token');
                const delta = getValueFromItems(eventData.uintItems, 'delta');
                const nextValue = getValueFromItems(eventData.uintItems, 'nextValue');

                updateCount++;
                console.log(`  Update #${updateCount}:`);
                console.log(`    Token: ${token === mUSD_ADDRESS ? 'mUSD' : token}`);
                console.log(`    Delta: +${ethers.utils.formatUnits(delta, 6)} mUSD`);
                console.log(`    Next Balance: ${ethers.utils.formatUnits(nextValue, 6)} mUSD`);
            } catch (error) {
                // Skip
            }
        }
    }
    console.log(``);

    // ========================================================================
    // STEP 2: Check what was actually claimed
    // ========================================================================
    console.log(`\n${'═'.repeat(100)}`);
    console.log(`STEP 2: Claim Transaction Analysis`);
    console.log(`${'═'.repeat(100)}\n`);

    const claimReceipt = await ethers.provider.getTransactionReceipt(CLAIM_TX);
    console.log(`Transaction: ${CLAIM_TX}`);
    console.log(`Block: ${CLAIM_BLOCK}\n`);

    // Check FundingFeesClaimed events
    const fundingClaimedHash = ethers.utils.id("FundingFeesClaimed");

    console.log(`FundingFeesClaimed Events:`);
    let totalClaimed = ethers.BigNumber.from(0);
    let claimCount = 0;
    for (const log of claimReceipt.logs) {
        if (log.topics[0] === eventLog1Topic0 && log.topics[1] === fundingClaimedHash) {
            try {
                const parsed = eventEmitter.interface.parseLog(log);
                const eventData = parsed.args[4];

                const market = getValueFromItems(eventData.addressItems, 'market');
                const token = getValueFromItems(eventData.addressItems, 'token');
                const amount = getValueFromItems(eventData.uintItems, 'amount');

                claimCount++;
                totalClaimed = totalClaimed.add(amount);

                console.log(`  Claim #${claimCount}:`);
                console.log(`    Market: ${market}`);
                console.log(`    Token: ${token === mUSD_ADDRESS ? 'mUSD' : token}`);
                console.log(`    Amount: ${ethers.utils.formatUnits(amount, 6)} mUSD`);
            } catch (error) {
                // Skip
            }
        }
    }

    console.log(`\n  Total Claimed: ${ethers.utils.formatUnits(totalClaimed, 6)} mUSD\n`);

    // Check actual Transfer events
    console.log(`Transfer Events (actual token movements):`);
    const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
    const erc20Interface = new ethers.utils.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 value)'
    ]);

    let totalTransferred = ethers.BigNumber.from(0);
    for (const log of claimReceipt.logs) {
        if (log.topics[0] === transferTopic && log.address.toLowerCase() === mUSD_ADDRESS.toLowerCase()) {
            const parsed = erc20Interface.parseLog(log);
            const to = parsed.args.to;
            const value = parsed.args.value;

            if (to.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                totalTransferred = totalTransferred.add(value);
                console.log(`  Transfer to user: ${ethers.utils.formatUnits(value, 6)} mUSD`);
            }
        }
    }

    console.log(`\n  Total mUSD Transferred to User: ${ethers.utils.formatUnits(totalTransferred, 6)} mUSD\n`);

    // ========================================================================
    // STEP 3: Conclusion
    // ========================================================================
    console.log(`\n${'═'.repeat(100)}`);
    console.log(`CONCLUSION`);
    console.log(`${'═'.repeat(100)}\n`);

    console.log(`Position close showed:`);
    console.log(`  Claimable Long: 20.20 mUSD`);
    console.log(`  Claimable Short: 20.20 mUSD`);
    console.log(`  Sum: 40.40 mUSD\n`);

    console.log(`Actual claim resulted in:`);
    console.log(`  Total Claimed (from events): ${ethers.utils.formatUnits(totalClaimed, 6)} mUSD`);
    console.log(`  Total Transferred (actual): ${ethers.utils.formatUnits(totalTransferred, 6)} mUSD\n`);

    if (totalTransferred.gt(ethers.utils.parseUnits("35", 6))) {
        console.log(`✅ ANSWER: User received ~40 mUSD (both long and short amounts)`);
        console.log(`   When long and short tokens are the same, BOTH amounts are claimable.`);
    } else if (totalTransferred.gt(ethers.utils.parseUnits("15", 6)) && totalTransferred.lt(ethers.utils.parseUnits("25", 6))) {
        console.log(`✅ ANSWER: User received ~20 mUSD (only one of the amounts)`);
        console.log(`   When long and short tokens are the same, they may be deduplicated.`);
    } else {
        console.log(`❓ ANSWER: Unclear - amount is ${ethers.utils.formatUnits(totalTransferred, 6)} mUSD`);
    }

    console.log(`\n✅ Done!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
