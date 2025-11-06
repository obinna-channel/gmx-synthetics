const { ethers } = require("hardhat");

/**
 * Get Full Transaction Details for Funding Claims
 *
 * This script gets the full transaction hash for the 0.77 claim
 */

async function main() {
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const TARGET_BLOCK = 209451679;

    const ADDRESSES = {
        EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C",
    };

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         GET FUNDING CLAIM TRANSACTION DETAILS                    ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    console.log(`Looking for FundingFeesClaimed at block ${TARGET_BLOCK}\n`);

    const eventLog1Topic0 = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';
    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);
    const accountBytes32 = ethers.utils.hexZeroPad(ACCOUNT_ADDRESS, 32);

    const fundingClaimedHash = ethers.utils.id("FundingFeesClaimed");
    const fundingClaimedFilter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: TARGET_BLOCK,
        toBlock: TARGET_BLOCK,
        topics: [
            eventLog1Topic0,
            fundingClaimedHash,
            accountBytes32
        ]
    };

    const logs = await ethers.provider.getLogs(fundingClaimedFilter);
    console.log(`Found ${logs.length} FundingFeesClaimed events at block ${TARGET_BLOCK}\n`);

    function getValueFromItems(items, key) {
        if (!items || !items.items) return null;
        for (const item of items.items) {
            if (item.key === key) {
                return item.value;
            }
        }
        return null;
    }

    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        console.log(`\n${'═'.repeat(100)}`);
        console.log(`Event #${i + 1}`);
        console.log(`${'═'.repeat(100)}`);
        console.log(`Transaction Hash: ${log.transactionHash}`);
        console.log(`Block Number: ${log.blockNumber}`);
        console.log(`Log Index: ${log.logIndex}`);

        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventData = parsed.args[4];

            const market = getValueFromItems(eventData.addressItems, 'market');
            const token = getValueFromItems(eventData.addressItems, 'token');
            const account = getValueFromItems(eventData.addressItems, 'account');
            const receiver = getValueFromItems(eventData.addressItems, 'receiver');
            const amount = getValueFromItems(eventData.uintItems, 'amount');
            const nextPoolValue = getValueFromItems(eventData.uintItems, 'nextPoolValue');

            console.log(`\nEvent Data:`);
            console.log(`  Market: ${market}`);
            console.log(`  Token: ${token}`);
            console.log(`  Account: ${account}`);
            console.log(`  Receiver: ${receiver}`);
            console.log(`  Amount: ${ethers.utils.formatUnits(amount, 6)} tokens`);
            console.log(`  Next Pool Value: ${ethers.utils.formatUnits(nextPoolValue, 30)} USD`);
        } catch (error) {
            console.log(`Error parsing: ${error.message}`);
        }
    }

    // Now let's also check what happened BEFORE this claim
    // Look for ClaimableFundingUpdated events in the blocks leading up to this
    console.log(`\n\n${'═'.repeat(100)}`);
    console.log(`LOOKING FOR CLAIMABLE FUNDING HISTORY (10 blocks before claim)`);
    console.log(`${'═'.repeat(100)}\n`);

    const claimableFundingUpdatedHash = ethers.utils.id("ClaimableFundingUpdated");
    const historyFilter = {
        address: ADDRESSES.EVENT_EMITTER,
        fromBlock: TARGET_BLOCK - 10000,
        toBlock: TARGET_BLOCK - 1,
        topics: [
            eventLog1Topic0,
            claimableFundingUpdatedHash,
            accountBytes32
        ]
    };

    const historyLogs = await ethers.provider.getLogs(historyFilter);
    console.log(`Found ${historyLogs.length} ClaimableFundingUpdated events in the 10k blocks before the claim\n`);

    const updates = [];
    for (const log of historyLogs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventData = parsed.args[4];

            const market = getValueFromItems(eventData.addressItems, 'market');
            const token = getValueFromItems(eventData.addressItems, 'token');
            const timeKey = getValueFromItems(eventData.uintItems, 'timeKey');
            const delta = getValueFromItems(eventData.uintItems, 'delta');
            const nextValue = getValueFromItems(eventData.uintItems, 'nextValue');

            updates.push({
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
                market,
                token,
                timeKey,
                delta,
                nextValue
            });
        } catch (error) {
            // Skip
        }
    }

    // Sort by block (most recent first)
    updates.sort((a, b) => b.blockNumber - a.blockNumber);

    console.log(`| Block    | Market (first 20)    | Delta (tokens) | Next Value (tokens) | Tx (first 12)        |`);
    console.log(`|----------|----------------------|----------------|---------------------|----------------------|`);

    for (const update of updates) {
        const marketStr = update.market.slice(0, 20).padEnd(20);
        const delta = ethers.utils.formatUnits(update.delta, 6);
        const nextValue = ethers.utils.formatUnits(update.nextValue, 6);
        const txStr = update.transactionHash.slice(0, 12).padEnd(20);

        console.log(`| ${update.blockNumber.toString().padStart(8)} | ${marketStr} | ${delta.padStart(14)} | ${nextValue.padStart(19)} | ${txStr} |`);
    }

    console.log(`\n✅ Done!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
