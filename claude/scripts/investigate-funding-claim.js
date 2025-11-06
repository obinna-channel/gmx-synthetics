const { ethers } = require("hardhat");

/**
 * Investigate Specific Funding Claim
 *
 * This script investigates the 0.77 token claim at block 209451679
 * to understand where it came from
 */

async function main() {
    const TX_HASH = "0xa2af34d1d7e64b27502b09fe658ace40f70f1b58290579510a3770d4b69504b4";
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";

    const ADDRESSES = {
        EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C",
        mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
    };

    const MARKETS = {
        "0x53b49A28054D108d7050B0E5C317001bE984EB2D": "sNGN [USDT-sNGN]",
        "0xb1faf4aFd5bd6aA53CF056BBA31CCa1C44234a24": "sNGN [USDT-USDT]",
        "0x8E4C5f3296A100d4135187C3181258cb8a223bb1": "USDT [USDT-sNGN]",
        "0x2926c00ACE0D5915b222E4767D2D67CE960bFd2f": "mNGN [USDT-mNGN]",
        "0x2AE76b768a26CA2DfCcd7ccB46273D3C8283C2A7": "USDT [USDT-mNGN]",
        "0xD5e527b02d691054AEDd4733029aa06E895EA3CD": "mNGN [mNGN-USDT]",
        "0xf7F4Bb2014A164A919Ccec2b97Bd4805f86B83aD": "mUSD [mUSD-mNGN]",
        "0xb0D93252624e03138a261689eDE446F6BEd768BF": "mNGN [mUSD-mNGN]",
        "0x5E63276Caae0FF49b2762b98A1d37941AA50F804": "mUSDTNGN [mUSD-mNGN]",
        "0x784c2e2C5499853d052D339ed2834782C7C816b6": "mTSLA [USDT-USDT]",
        "0x8ae559448a1482faffC925eF6a233276588348Df": "mTSLA [mUSD-mUSD]",
        "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69": "mUSDTARS [mUSD-mUSD]",
        "0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C": "mNVDA [mUSD-mUSD]",
        "0x85590d2166Ca4D68d5b96C6CFdcC1a59c8C7B383": "mPKR [mUSD-mUSD]",
        "0x53Ab653715F2A2E3e228f17fBe120F7BEe3d7B44": "mCOP [mUSD-mUSD]",
        "0x8fb33464be3BE26d0BAd21B6F04e7c1Cf2B10449": "mAAPL [mUSD-mUSD]",
        "0xafd908D358315efDBA493311AbE30648DEC4d2dE": "mMETA [mUSD-mUSD]",
        "0x1aF0891884AD96De1Cb1CC3fDEd67842F00926bb": "mUSDTNGN [mUSD-mUSD]",
    };

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         INVESTIGATE FUNDING CLAIM 0.77 TOKENS                    ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    console.log(`Transaction: ${TX_HASH}\n`);

    // Get transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);

    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log(`Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`\nTotal Events: ${receipt.logs.length}\n`);

    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);
    const eventLog1Topic0 = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';

    // Helper function to extract values from items arrays
    function getValueFromItems(items, key) {
        if (!items || !items.items) return null;
        for (const item of items.items) {
            if (item.key === key) {
                return item.value;
            }
        }
        return null;
    }

    console.log(`═`.repeat(100));
    console.log(`\n📜 ALL EVENTS IN TRANSACTION\n`);
    console.log(`═`.repeat(100));

    const allEvents = [];

    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];

        // Try to parse as EventLog1
        if (log.topics[0] === eventLog1Topic0) {
            try {
                const parsed = eventEmitter.interface.parseLog(log);
                const eventName = parsed.args[1];
                const eventData = parsed.args[4];

                allEvents.push({
                    index: i,
                    eventName,
                    eventData,
                    log
                });

                console.log(`\nEvent #${i}: ${eventName}`);
                console.log(`─`.repeat(80));
            } catch (error) {
                console.log(`\nEvent #${i}: Could not parse`);
            }
        }
    }

    // Now display detailed info for each event
    for (const event of allEvents) {
        console.log(`\n\n${'═'.repeat(100)}`);
        console.log(`EVENT: ${event.eventName}`);
        console.log(`${'═'.repeat(100)}\n`);

        const eventData = event.eventData;

        // Display address items
        if (eventData.addressItems && eventData.addressItems.items) {
            console.log(`Address Items:`);
            for (const item of eventData.addressItems.items) {
                const value = item.value;
                let displayValue = value;

                // Check if it's a known market
                if (MARKETS[value.toLowerCase()] || MARKETS[value]) {
                    displayValue = `${value} (${MARKETS[value.toLowerCase()] || MARKETS[value]})`;
                } else if (value.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                    displayValue = `${value} (USER ACCOUNT)`;
                } else if (value === ADDRESSES.mUSD) {
                    displayValue = `${value} (mUSD)`;
                }

                console.log(`  ${item.key}: ${displayValue}`);
            }
        }

        // Display uint items
        if (eventData.uintItems && eventData.uintItems.items) {
            console.log(`\nUint Items:`);
            for (const item of eventData.uintItems.items) {
                // Try to format intelligently based on key name
                let formatted = item.value.toString();

                if (item.key.toLowerCase().includes('amount') ||
                    item.key.toLowerCase().includes('value') ||
                    item.key.toLowerCase().includes('delta')) {
                    // Try as 6 decimals (token amount)
                    const as6Dec = ethers.utils.formatUnits(item.value, 6);
                    // Try as 30 decimals (USD)
                    const as30Dec = ethers.utils.formatUnits(item.value, 30);

                    console.log(`  ${item.key}:`);
                    console.log(`    Raw: ${formatted}`);
                    console.log(`    As 6 decimals (tokens): ${as6Dec}`);
                    console.log(`    As 30 decimals (USD): ${as30Dec}`);
                } else {
                    console.log(`  ${item.key}: ${formatted}`);
                }
            }
        }

        // Display int items
        if (eventData.intItems && eventData.intItems.items) {
            console.log(`\nInt Items:`);
            for (const item of eventData.intItems.items) {
                const formatted = ethers.utils.formatUnits(item.value, 30);
                console.log(`  ${item.key}: ${formatted} (30 decimals)`);
            }
        }

        // Display bool items
        if (eventData.boolItems && eventData.boolItems.items) {
            console.log(`\nBool Items:`);
            for (const item of eventData.boolItems.items) {
                console.log(`  ${item.key}: ${item.value}`);
            }
        }

        // Display bytes32 items
        if (eventData.bytes32Items && eventData.bytes32Items.items) {
            console.log(`\nBytes32 Items:`);
            for (const item of eventData.bytes32Items.items) {
                console.log(`  ${item.key}: ${item.value}`);
            }
        }
    }

    console.log(`\n\n${'═'.repeat(100)}`);
    console.log(`\n✅ Investigation complete!\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
