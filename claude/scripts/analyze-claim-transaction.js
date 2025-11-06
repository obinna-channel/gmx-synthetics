const { ethers } = require("hardhat");

/**
 * Analyze the 0.77 claim transaction in detail
 */

async function main() {
    const TX_HASH = "0xa2af34d1d7e64b27502b09fe658ace40f70f1b58290579510a3770d4b69504b4";

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         ANALYZE 0.77 CLAIM TRANSACTION                           ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    // Get transaction
    const tx = await ethers.provider.getTransaction(TX_HASH);
    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);

    console.log(`Transaction Details:`);
    console.log(`  Hash: ${tx.hash}`);
    console.log(`  Block: ${tx.blockNumber}`);
    console.log(`  From: ${tx.from}`);
    console.log(`  To: ${tx.to}`);
    console.log(`  Value: ${ethers.utils.formatEther(tx.value)} ETH`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`\n`);

    // Try to decode the function call
    console.log(`Input Data:`);
    console.log(`  ${tx.data.slice(0, 100)}...\n`);

    // Get function selector (first 4 bytes)
    const selector = tx.data.slice(0, 10);
    console.log(`Function Selector: ${selector}\n`);

    // Common selectors
    const knownSelectors = {
        '0x48f35cbb': 'executeWithdrawal(bytes32,OracleUtils.SetPricesParams)',
        '0x7b1039b7': 'executeOrder(bytes32,OracleUtils.SetPricesParams)',
        '0x2dffd847': 'batchClaimFundingFees(address[],address[])',
        '0x': 'unknown'
    };

    console.log(`Likely Function: ${knownSelectors[selector] || 'Unknown'}\n`);

    // Check if it's a multicall or batch operation
    if (selector === '0x2dffd847') {
        console.log(`This is a batchClaimFundingFees call!`);
        console.log(`The user is claiming accumulated funding fees from multiple markets.\n`);
    }

    // Analyze all events
    console.log(`═`.repeat(100));
    console.log(`ALL EVENTS IN TRANSACTION (${receipt.logs.length} total)`);
    console.log(`═`.repeat(100));

    const eventEmitter = await ethers.getContractAt("EventEmitter", "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C");
    const eventLog1Topic0 = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    const allEventNames = [];
    for (const log of receipt.logs) {
        if (log.topics[0] === eventLog1Topic0) {
            try {
                const parsed = eventEmitter.interface.parseLog(log);
                const eventName = parsed.args[1];
                allEventNames.push(eventName);
                console.log(`  - ${eventName}`);
            } catch (error) {
                console.log(`  - [Could not parse]`);
            }
        } else {
            // Try to identify by topic
            if (log.topics[0] === ethers.utils.id('Transfer(address,address,uint256)')) {
                console.log(`  - Transfer (ERC20)`);
            } else {
                console.log(`  - [Other event: ${log.topics[0].slice(0, 10)}...]`);
            }
        }
    }

    console.log(`\n\n${'═'.repeat(100)}`);
    console.log(`SUMMARY`);
    console.log(`${'═'.repeat(100)}\n`);

    console.log(`Event counts:`);
    const eventCounts = {};
    for (const name of allEventNames) {
        eventCounts[name] = (eventCounts[name] || 0) + 1;
    }
    for (const [name, count] of Object.entries(eventCounts)) {
        console.log(`  ${name}: ${count}`);
    }

    console.log(`\n✅ Done!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
