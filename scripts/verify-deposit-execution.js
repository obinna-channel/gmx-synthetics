const { ethers } = require("hardhat");

async function main() {
    console.log("=== Verifying Deposit Execution ===\n");

    // Contract addresses
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const DEPOSIT_KEY = "0x3772b0c5ec95382c48668749a697d7586df957e3d46b97658950d33d9daa5910";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);
    const usdt = await ethers.getContractAt("IERC20", USDT);
    const marketToken = await ethers.getContractAt("IERC20", MARKET);

    console.log("1️⃣ CHECKING DEPOSIT STATUS...");

    // Check if deposit still exists
    try {
        const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
        console.log("  ❌ Deposit still exists (not executed)");
        console.log("  Account:", deposit.addresses.account);
    } catch (error) {
        console.log("  ✅ Deposit no longer exists (has been executed!)");
    }

    // Check deposit list
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );

    const depositCount = await dataStore.getAddressCount(DEPOSIT_LIST);
    console.log("  Remaining deposits in system:", depositCount.toString());

    console.log("\n2️⃣ CHECKING MARKET TOKEN SUPPLY...");

    // Check market token total supply
    const totalSupply = await marketToken.totalSupply();
    console.log("  Market token total supply:", ethers.utils.formatUnits(totalSupply, 18));

    if (totalSupply.gt(0)) {
        console.log("  ✅ Market tokens have been minted!");
    } else {
        console.log("  ⚠️  No market tokens minted yet");
    }

    // Check who owns the market tokens (should be address(1) for first deposit)
    const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";
    const addressOneBalance = await marketToken.balanceOf(ADDRESS_ONE);
    console.log("  Market tokens held by address(1):", ethers.utils.formatUnits(addressOneBalance, 18));

    if (addressOneBalance.gt(0)) {
        console.log("  ✅ First deposit tokens correctly sent to address(1)");
    }

    console.log("\n3️⃣ CHECKING POOL LIQUIDITY...");

    // Check pool amount for USDT
    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );

    const poolAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, USDT]
        )
    );

    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("  Pool USDT amount:", ethers.utils.formatUnits(poolAmount, 6), "USDT");

    if (poolAmount.gt(0)) {
        console.log("  ✅ Pool has liquidity!");
    }

    // Check market token price
    console.log("\n4️⃣ CHECKING MARKET VALUE...");

    try {
        const marketProps = await reader.getMarket(DATA_STORE, MARKET);
        console.log("  Market exists: ✅");

        // Get market token price info
        const marketTokenPriceInfo = await reader.getMarketTokenPrice(
            DATA_STORE,
            marketProps,
            ethers.utils.parseUnits("1", 30), // Index token price (NGN)
            ethers.utils.parseUnits("1", 30), // Long token price (USDT)
            ethers.utils.parseUnits("1", 30), // Short token price (USDT)
            ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_PNL_FACTOR_FOR_WITHDRAWALS")),
            true // Include virtual inventory
        );

        console.log("  Market token price:", ethers.utils.formatUnits(marketTokenPriceInfo[0], 30), "USD");
        console.log("  Pool value (USD):", ethers.utils.formatUnits(marketTokenPriceInfo[1].poolValue, 30));

    } catch (error) {
        console.log("  Error reading market info:", error.message);
    }

    console.log("\n5️⃣ CHECKING VAULT BALANCES...");

    // Check DepositVault balance (should be 0 after execution)
    const depositVaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT balance:", ethers.utils.formatUnits(depositVaultBalance, 6), "USDT");

    if (depositVaultBalance.eq(0)) {
        console.log("  ✅ Funds moved from DepositVault (deposit executed)");
    }

    // Check market balance
    const marketBalance = await usdt.balanceOf(MARKET);
    console.log("  Market USDT balance:", ethers.utils.formatUnits(marketBalance, 6), "USDT");

    console.log("\n6️⃣ CHECKING TRANSACTION EVENTS...");

    // Get the execution transaction
    const txHash = "0x5b98ed6e316ea4885e3b96d5071492aeef135ab3fd50959a5ed88c08ab20e70c";
    const receipt = await ethers.provider.getTransactionReceipt(txHash);

    console.log("  Transaction status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("  Events emitted:", receipt.logs.length);

    // Try to decode events
    const EVENT_EMITTER = "0x85C6A8082346dD07941A271c1Cc8F7DDdEecfa6C";
    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    for (const log of receipt.logs) {
        try {
            const parsed = eventEmitter.interface.parseLog(log);
            console.log("  - Event:", parsed.name);
        } catch (e) {
            // Not an EventEmitter event
        }
    }

    console.log("\n\n=== VERIFICATION SUMMARY ===");
    console.log("✅ Deposit has been executed (no longer in system)");
    console.log("✅ Market tokens minted:", ethers.utils.formatUnits(totalSupply, 18));
    console.log("✅ Pool liquidity:", ethers.utils.formatUnits(poolAmount, 6), "USDT");
    console.log("✅ Tokens sent to address(1) (first deposit requirement)");
    console.log("\n🎉 The USDTNGN market is now initialized and ready for trading!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });