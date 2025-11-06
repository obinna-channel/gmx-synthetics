const { ethers } = require("hardhat");
const axios = require("axios");

/**
 * Comprehensive Position Close Reconciliation Script
 *
 * This script helps debug discrepancies between:
 * - Expected PnL + Claimable Funding (from Reader)
 * - Actual amounts transferred to user (from transaction events)
 *
 * Usage:
 * 1. Set TX_HASH to your decrease/close transaction
 * 2. Set ACCOUNT_ADDRESS to the position owner
 * 3. Run: npx hardhat run claude/scripts/reconcile-position-close.js --network arbitrumSepolia
 */

async function main() {
    // ============ CONFIGURATION ============
    const TX_HASH = "0xYOUR_TRANSACTION_HASH_HERE"; // <-- UPDATE THIS
    const ACCOUNT_ADDRESS = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44"; // <-- UPDATE THIS

    // Contract addresses
    const ADDRESSES = {
        DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
        READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",
        REFERRAL_STORAGE: "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547",
        ORDER_VAULT: "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F",
        mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
        EVENT_EMITTER: "0x05a9B2e66c3A683D1cc13C18BE144C1f1268E5B0",
    };

    // Markets to check
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
    console.log("║         POSITION CLOSE RECONCILIATION DEBUG SCRIPT              ║");
    console.log("╚══════════════════════════════════════════════════════════════════╝\n");

    const [signer] = await ethers.getSigners();

    // ============ STEP 1: Get Transaction Details ============
    console.log("📋 STEP 1: Analyzing Transaction");
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
        console.log(`❌ Error fetching transaction: ${error.message}`);
        console.log(`\n💡 Make sure TX_HASH is set correctly at the top of the script`);
        return;
    }

    // ============ STEP 2: Extract Transfer Events ============
    console.log("\n\n💸 STEP 2: Actual Transfers (from blockchain events)");
    console.log("─".repeat(70));

    const TRANSFER_SIG = ethers.utils.id("Transfer(address,address,uint256)");
    const transfers = [];
    let totalTransferred = ethers.BigNumber.from(0);

    for (const log of receipt.logs) {
        if (log.topics[0] === TRANSFER_SIG &&
            log.address.toLowerCase() === ADDRESSES.mUSD.toLowerCase()) {

            const from = '0x' + log.topics[1].slice(-40);
            const to = '0x' + log.topics[2].slice(-40);
            const amount = ethers.BigNumber.from(log.data);

            transfers.push({ from, to, amount });

            // Track transfers TO the user
            if (to.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                totalTransferred = totalTransferred.add(amount);
                console.log(`\n✅ Transfer TO user:`);
                console.log(`   From: ${from}`);
                console.log(`   Amount: ${ethers.utils.formatUnits(amount, 6)} mUSD`);
            }
            // Track transfers FROM the user
            else if (from.toLowerCase() === ACCOUNT_ADDRESS.toLowerCase()) {
                console.log(`\n⬆️  Transfer FROM user:`);
                console.log(`   To: ${to}`);
                console.log(`   Amount: ${ethers.utils.formatUnits(amount, 6)} mUSD`);
            }
        }
    }

    console.log(`\n📊 Total transferred TO user: ${ethers.utils.formatUnits(totalTransferred, 6)} mUSD`);

    if (totalTransferred.eq(0)) {
        console.log(`\n⚠️  WARNING: No transfers to user found!`);
        console.log(`   This could mean:`);
        console.log(`   - Position was reduced but not closed`);
        console.log(`   - All PnL was negative (fees exceeded gains)`);
        console.log(`   - Transaction failed`);
    }

    // ============ STEP 3: Decode Order Execution Events ============
    console.log("\n\n📜 STEP 3: Order Execution Details");
    console.log("─".repeat(70));

    const eventEmitter = await ethers.getContractAt("EventEmitter", ADDRESSES.EVENT_EMITTER);
    const eventEmitterInterface = eventEmitter.interface;

    // Look for OrderExecuted event
    const ORDER_EXECUTED_SIG = ethers.utils.id("OrderExecuted(bytes32,uint256)");
    const EVENT_LOG1_SIG = ethers.utils.id("EventLog1(address,string,string,bytes32,bytes)");

    let orderKey = null;
    let orderExecutedFound = false;

    for (const log of receipt.logs) {
        try {
            if (log.address.toLowerCase() === ADDRESSES.EVENT_EMITTER.toLowerCase()) {
                const parsed = eventEmitterInterface.parseLog(log);

                if (parsed.name === "EventLog1") {
                    const eventName = parsed.args.eventName;

                    if (eventName === "OrderExecuted") {
                        orderExecutedFound = true;
                        orderKey = parsed.args.topic1;
                        console.log(`✅ Order executed successfully`);
                        console.log(`   Order Key: ${orderKey}`);
                    }
                    else if (eventName === "OrderCancelled") {
                        console.log(`❌ Order was CANCELLED`);
                        console.log(`   Reason: Check cancellation reason in events`);
                        orderKey = parsed.args.topic1;
                    }
                }
            }
        } catch (error) {
            // Skip logs we can't parse
        }
    }

    if (!orderExecutedFound) {
        console.log(`⚠️  No OrderExecuted event found`);
        console.log(`   The order may have been cancelled or is still pending`);
    }

    // ============ STEP 4: Get Position State BEFORE Close ============
    console.log("\n\n🔍 STEP 4: Position State Analysis");
    console.log("─".repeat(70));

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

    console.log(`Fetching current prices...`);
    const priceCache = {};
    for (const [addr, info] of Object.entries(MARKETS)) {
        const price = await fetchPrice(info.pricePair);
        if (price) priceCache[addr.toLowerCase()] = price;
    }

    // Get position info using Reader
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

    let positionInfoList;
    try {
        positionInfoList = await reader.getAccountPositionInfoList(
            ADDRESSES.DATA_STORE,
            ADDRESSES.REFERRAL_STORAGE,
            ACCOUNT_ADDRESS,
            allMarkets,
            marketPricesPayload,
            ethers.constants.AddressZero,
            0,
            1000
        );

        console.log(`✅ Found ${positionInfoList.length} open positions for this account\n`);
    } catch (error) {
        console.log(`❌ Error fetching positions: ${error.message}`);
        positionInfoList = [];
    }

    // Display current positions
    if (positionInfoList.length > 0) {
        console.log(`Current Open Positions:`);
        for (const posInfo of positionInfoList) {
            const { position, fees, basePnlUsd } = posInfo;
            const { addresses, numbers, flags } = position;

            if (numbers.sizeInUsd.eq(0)) continue;

            const marketInfo = MARKETS[addresses.market.toLowerCase()];
            const sizeUsd = ethers.utils.formatUnits(numbers.sizeInUsd, 30);
            const collateral = ethers.utils.formatUnits(numbers.collateralAmount, 6);
            const pnl = ethers.utils.formatUnits(basePnlUsd, 30);

            const claimableLong = ethers.utils.formatUnits(fees.funding.claimableLongTokenAmount, 6);
            const claimableShort = ethers.utils.formatUnits(fees.funding.claimableShortTokenAmount, 6);

            console.log(`\n   ${marketInfo?.name || 'UNKNOWN'} ${flags.isLong ? 'LONG' : 'SHORT'}`);
            console.log(`   - Size: $${parseFloat(sizeUsd).toFixed(2)}`);
            console.log(`   - Collateral: ${parseFloat(collateral).toFixed(2)} mUSD`);
            console.log(`   - PnL: ${parseFloat(pnl) >= 0 ? '+' : ''}${parseFloat(pnl).toFixed(2)} USD`);
            console.log(`   - Claimable Funding: ${parseFloat(claimableLong).toFixed(2)} mUSD (long) + ${parseFloat(claimableShort).toFixed(2)} mUSD (short)`);
        }
    }

    // ============ STEP 5: Reconciliation ============
    console.log("\n\n💰 STEP 5: Reconciliation Analysis");
    console.log("─".repeat(70));

    console.log(`\n⚠️  MANUAL RECONCILIATION NEEDED:`);
    console.log(`\nTo complete the reconciliation, you need to:`);
    console.log(`\n1. Note the position details BEFORE closing (size, collateral, PnL, claimable)`);
    console.log(`2. Execute the close transaction`);
    console.log(`3. Run this script with the transaction hash`);
    console.log(`4. Compare:`);
    console.log(`   - Expected: Collateral + PnL + Claimable - Fees`);
    console.log(`   - Actual: Total transferred (from Step 2)`);
    console.log(`\n5. Key fees to account for:`);
    console.log(`   - Position fee (execution fee)`);
    console.log(`   - Funding fees (negative funding reduces payout)`);
    console.log(`   - Borrowing fees`);
    console.log(`   - Price impact`);
    console.log(`   - Swap fees (if closing reduces collateral token)`);

    // ============ STEP 6: Recommendations ============
    console.log("\n\n🔧 STEP 6: Debugging Recommendations");
    console.log("─".repeat(70));

    console.log(`\nFor detailed debugging:`);
    console.log(`\n1. Check contract code for fee calculations:`);
    console.log(`   - contracts/position/DecreasePositionUtils.sol`);
    console.log(`   - contracts/fee/FeeUtils.sol`);
    console.log(`   - contracts/position/DecreasePositionCollateralUtils.sol`);

    console.log(`\n2. Look for these events in the transaction:`);
    console.log(`   - PositionFeesCollected (shows all fees deducted)`);
    console.log(`   - PositionDecrease (shows size/collateral changes)`);
    console.log(`   - ClaimableFundingUpdated (shows funding applied)`);

    console.log(`\n3. Common discrepancy causes:`);
    console.log(`   - Negative funding fees reduce claimable amount`);
    console.log(`   - Price impact on position decrease`);
    console.log(`   - Borrowing fees accumulated since last update`);
    console.log(`   - Execution fee paid to keeper`);
    console.log(`   - UI fees (if UI fee receiver is set)`);

    console.log(`\n4. Tools to use:`);
    console.log(`   - Arbitrum block explorer to see all events`);
    console.log(`   - Reader.getPositionInfo() before/after to compare`);
    console.log(`   - DataStore queries for fee parameters`);

    console.log("\n\n" + "═".repeat(70));
    console.log("✅ Analysis complete!");
    console.log("═".repeat(70) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
