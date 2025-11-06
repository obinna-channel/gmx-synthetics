const { ethers } = require("hardhat");

/**
 * Find ALL mUSD transfers in a specific transaction
 */

async function main() {
    const TX_HASH = "0x1420d06b5ab4c564af39d5dc7463212acfb3de879db631899bcf263dfd2a1788";
    const mUSD_ADDRESS = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";

    console.log("\n╔══════════════════════════════════════════════════════════════════╗");
    console.log("║         ALL mUSD TRANSFERS IN TRANSACTION                        ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    console.log(`📋 Transaction: ${TX_HASH}`);
    console.log(`💰 Token: mUSD (${mUSD_ADDRESS})`);
    console.log(`👤 User Account: ${ACCOUNT_ADDRESS}\n`);

    // Get transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
    if (!receipt) {
        console.log("❌ Transaction not found!");
        return;
    }

    console.log(`✅ Transaction found in block ${receipt.blockNumber}\n`);

    // Transfer event signature
    const TRANSFER_SIG = ethers.utils.id("Transfer(address,address,uint256)");

    // Filter for all Transfer events from mUSD token
    const filter = {
        address: mUSD_ADDRESS,
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
        topics: [TRANSFER_SIG]
    };

    console.log(`📊 Querying for all mUSD transfers in this block...`);
    const logs = await ethers.provider.getLogs(filter);

    // Filter to only this transaction
    const txLogs = logs.filter(log => log.transactionHash === TX_HASH);
    console.log(`   ✅ Found ${txLogs.length} mUSD transfer(s) in this transaction\n`);

    if (txLogs.length === 0) {
        console.log("❌ No mUSD transfers found in this transaction!");
        return;
    }

    const mUSD = await ethers.getContractAt("IERC20", mUSD_ADDRESS);
    const transferInterface = mUSD.interface;

    console.log("═".repeat(100));
    console.log("\n📜 ALL mUSD TRANSFERS (in order)\n");
    console.log("═".repeat(100));

    let totalToUser = ethers.BigNumber.from(0);
    let totalFromUser = ethers.BigNumber.from(0);

    for (let i = 0; i < txLogs.length; i++) {
        const log = txLogs[i];

        try {
            const parsed = transferInterface.parseLog(log);
            const from = parsed.args.from;
            const to = parsed.args.to;
            const amount = parsed.args.value;
            const amountFormatted = ethers.utils.formatUnits(amount, 6);

            console.log(`\n${i + 1}. TRANSFER`);
            console.log(`   Log Index: ${log.logIndex}`);
            console.log(`   From:   ${from}`);
            console.log(`   To:     ${to}`);
            console.log(`   Amount: ${parseFloat(amountFormatted).toFixed(6)} mUSD`);

            // Check if this involves the user
            if (to.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                console.log(`   >>> TO USER <<<`);
                totalToUser = totalToUser.add(amount);
            }
            if (from.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                console.log(`   >>> FROM USER <<<`);
                totalFromUser = totalFromUser.add(amount);
            }

        } catch (error) {
            console.log(`   ❌ Error parsing transfer: ${error.message}`);
        }
    }

    console.log("\n" + "═".repeat(100));
    console.log("\n💰 NET FLOW FOR USER\n");
    console.log("═".repeat(100));

    console.log(`\n   Total TO user:   ${ethers.utils.formatUnits(totalToUser, 6)} mUSD`);
    console.log(`   Total FROM user: ${ethers.utils.formatUnits(totalFromUser, 6)} mUSD`);
    console.log(`   ─────────────────────────────────────────────────────────────`);
    const netFlow = totalToUser.sub(totalFromUser);
    console.log(`   Net Flow:        ${netFlow.gte(0) ? '+' : ''}${ethers.utils.formatUnits(netFlow, 6)} mUSD`);

    console.log("\n" + "═".repeat(100) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
