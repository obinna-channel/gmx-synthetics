const { ethers } = require("hardhat");

/**
 * Decode Transfer events to see actual token movements
 */

async function main() {
    const TX_HASH = "0xa2af34d1d7e64b27502b09fe658ace40f70f1b58290579510a3770d4b69504b4";
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";
    const mUSD_ADDRESS = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         DECODE TRANSFER EVENTS                                   ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);

    console.log(`Transaction: ${TX_HASH}`);
    console.log(`Block: ${receipt.blockNumber}\n`);

    const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
    const erc20Interface = new ethers.utils.Interface([
        'event Transfer(address indexed from, address indexed to, uint256 value)'
    ]);

    console.log(`${'═'.repeat(100)}`);
    console.log(`TRANSFER EVENTS`);
    console.log(`${'═'.repeat(100)}\n`);

    let transferIndex = 0;
    for (const log of receipt.logs) {
        if (log.topics[0] === transferTopic) {
            transferIndex++;
            const parsed = erc20Interface.parseLog(log);
            const from = parsed.args.from;
            const to = parsed.args.to;
            const value = parsed.args.value;

            console.log(`Transfer #${transferIndex}:`);
            console.log(`  Token: ${log.address === mUSD_ADDRESS ? 'mUSD' : log.address}`);
            console.log(`  From: ${from}`);
            console.log(`  To: ${to}`);
            console.log(`  Amount: ${ethers.utils.formatUnits(value, 6)} tokens`);

            if (to.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                console.log(`  ⭐ This transfer goes TO the user (claim payment)`);
            } else if (from.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                console.log(`  💸 This transfer comes FROM the user (fee payment)`);
            }

            console.log(``);
        }
    }

    console.log(`${'═'.repeat(100)}\n`);

    // Now let's understand: was this a standalone claim or part of a larger operation?
    const eventEmitter = await ethers.getContractAt("EventEmitter", "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C");
    const eventLog1Topic0 = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    console.log(`OTHER EVENTS (to understand context):\n`);

    for (const log of receipt.logs) {
        if (log.topics[0] === eventLog1Topic0) {
            try {
                const parsed = eventEmitter.interface.parseLog(log);
                const eventName = parsed.args[1];
                console.log(`  - ${eventName}`);
            } catch (error) {
                // Skip
            }
        }
    }

    console.log(`\n✅ Done!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
