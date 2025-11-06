const { ethers } = require("hardhat");

async function main() {
    const TARGET_USER = "0xfE6a58323acFd101981CB00530Fb8089B137115F";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const READER = "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8";
    const ORDER_VAULT = "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F";

    console.log("=== Checking User Position Directly ===\n");
    console.log("User:", TARGET_USER);
    console.log();

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const musd = await ethers.getContractAt("IERC20", mUSD);

    // Check for mUSD transfers to OrderVault from this user
    console.log("📋 Checking mUSD transfers to OrderVault...\n");

    const currentBlock = await ethers.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 500000);

    const transferFilter = musd.filters.Transfer(TARGET_USER, ORDER_VAULT);
    const transfers = await musd.queryFilter(transferFilter, fromBlock, currentBlock);

    console.log(`Found ${transfers.length} mUSD transfers from user to OrderVault\n`);

    for (const transfer of transfers) {
        const amount = ethers.utils.formatUnits(transfer.args.value, 6);
        console.log(`💵 Transfer: ${amount} mUSD`);
        console.log(`   Block: ${transfer.blockNumber}`);
        console.log(`   Tx: ${transfer.transactionHash}`);
        console.log();
    }

    if (transfers.length === 0) {
        console.log("❌ No mUSD transfers found to OrderVault");
        console.log("   Checking ExchangeRouter instead...\n");

        const EXCHANGE_ROUTER = "0x3B33708e9b8242999459EB9b4756C24c846e5936";
        const routerFilter = musd.filters.Transfer(TARGET_USER, EXCHANGE_ROUTER);
        const routerTransfers = await musd.queryFilter(routerFilter, fromBlock, currentBlock);

        console.log(`Found ${routerTransfers.length} mUSD transfers to ExchangeRouter\n`);

        for (const transfer of routerTransfers) {
            const amount = ethers.utils.formatUnits(transfer.args.value, 6);
            console.log(`💵 Transfer: ${amount} mUSD`);
            console.log(`   Block: ${transfer.blockNumber}`);
            console.log(`   Tx: ${transfer.transactionHash}`);
            console.log();
        }
    }

    // Now check all position keys to see if this user has a position
    console.log("=".repeat(80));
    console.log("\n🔍 Checking for active positions...\n");

    const POSITION_LIST_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POSITION_LIST"])
    );

    const positionCount = await dataStore.getBytes32Count(POSITION_LIST_KEY);
    const totalToFetch = Math.min(positionCount.toNumber(), 1000);

    const positionKeys = await dataStore.getBytes32ValuesAt(
        POSITION_LIST_KEY,
        0,
        totalToFetch
    );

    const reader = await ethers.getContractAt("Reader", READER);

    for (const positionKey of positionKeys) {
        try {
            const position = await reader.getPosition(DATA_STORE, positionKey);

            if (position.addresses.account.toLowerCase() === TARGET_USER.toLowerCase()) {
                console.log("✅ FOUND USER POSITION!");
                console.log(`   Account: ${position.addresses.account}`);
                console.log(`   Market: ${position.addresses.market}`);
                console.log(`   Side: ${position.flags.isLong ? 'LONG' : 'SHORT'}`);
                console.log(`   Size: ${ethers.utils.formatUnits(position.numbers.sizeInUsd, 30)} USD`);
                console.log(`   Collateral: ${ethers.utils.formatUnits(position.numbers.collateralAmount, 6)} mUSD`);
                console.log(`   Key: ${positionKey}`);
                console.log();
            }
        } catch (e) {
            // Skip invalid positions
        }
    }
}

main().catch(console.error);
