const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Execution Result ===\n");

    const txHash = "0xf8c54aedd3b2e7c8b1a9a842addf2b84473c416481032e2acd7c17ea66888f97";
    const depositKey = "0xbf5b5e02d4fa05f2156a0980fe5e72346fd16fcbbd291c576a8c555bddce24c2";
    const MARKET = "0x8E4C5f3296A100d4135187C3181258cb8a223bb1";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    console.log("Transaction:", txHash);
    console.log("Deposit Key:", depositKey);

    // Get transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(txHash);

    console.log("\n📦 Transaction Status:");
    console.log("  Success:", receipt.status === 1 ? "YES ✅" : "NO ❌");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas Used:", receipt.gasUsed.toString());

    // Check for refund transfers
    console.log("\n💰 Checking for refunds/cancellation...");
    const USER = "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292";

    let hasUsdtRefund = false;
    let hasSngnRefund = false;

    for (const log of receipt.logs) {
        // Check for Transfer events (topic0 is Transfer signature)
        if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
            try {
                const iface = new ethers.utils.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
                const decoded = iface.parseLog(log);

                if (decoded.args.to.toLowerCase() === USER.toLowerCase()) {
                    if (log.address.toLowerCase() === USDT.toLowerCase()) {
                        console.log("  ❌ USDT REFUND DETECTED: Tokens returned to user");
                        console.log("    Amount:", ethers.utils.formatUnits(decoded.args.value, 6), "USDT");
                        hasUsdtRefund = true;
                    } else if (log.address.toLowerCase() === sNGN.toLowerCase()) {
                        console.log("  ❌ sNGN REFUND DETECTED: Tokens returned to user");
                        console.log("    Amount:", ethers.utils.formatUnits(decoded.args.value, 18), "sNGN");
                        hasSngnRefund = true;
                    }
                }
            } catch {}
        }
    }

    if (hasUsdtRefund || hasSngnRefund) {
        console.log("\n  ⚠️  Deposit was CANCELLED during execution!");
    }

    // Check if deposit still exists
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const stillExists = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);

    console.log("\n🔍 Deposit Status:");
    console.log("  Still in DEPOSIT_LIST:", stillExists ? "YES ❌ (not executed)" : "NO ✅ (processed)");

    // Check market token supply
    const marketToken = await ethers.getContractAt("MarketToken", MARKET);
    const totalSupply = await marketToken.totalSupply();
    const address1Balance = await marketToken.balanceOf("0x0000000000000000000000000000000000000001");

    console.log("\n🎯 Market Token Status:");
    console.log("  Total Supply:", ethers.utils.formatEther(totalSupply));
    console.log("  Address(1) Balance:", ethers.utils.formatEther(address1Balance));

    if (totalSupply.eq(0)) {
        console.log("  ❌ NO MARKET TOKENS MINTED");
    }

    // Check pool amounts
    const POOL_AMOUNT_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["POOL_AMOUNT"])
    );

    const usdtPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, USDT]
        )
    );

    const sngnPoolKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "address"],
            [POOL_AMOUNT_KEY, MARKET, sNGN]
        )
    );

    const usdtPoolAmount = await dataStore.getUint(usdtPoolKey);
    const sngnPoolAmount = await dataStore.getUint(sngnPoolKey);

    console.log("\n📊 Pool Amounts:");
    console.log("  USDT in pool:", ethers.utils.formatUnits(usdtPoolAmount, 6));
    console.log("  sNGN in pool:", ethers.utils.formatUnits(sngnPoolAmount, 18));

    if (usdtPoolAmount.eq(0) && sngnPoolAmount.eq(0)) {
        console.log("  ❌ Pool is empty - no liquidity added!");
    }

    console.log("\n📝 Summary:");
    if ((hasUsdtRefund || hasSngnRefund) && totalSupply.eq(0) && usdtPoolAmount.eq(0)) {
        console.log("❌ Deposit was CANCELLED during execution");
        console.log("\nPossible reasons:");
        console.log("1. MinMarketTokens check failed (first deposit might have minimum requirements)");
        console.log("2. Pool value calculation issues");
        console.log("3. Market configuration issues for the new USDT-indexed market");
    } else if (totalSupply.gt(0)) {
        console.log("✅ Deposit was SUCCESSFUL!");
    } else {
        console.log("⚠️  Unclear status - check transaction logs");
    }

    console.log("\nView on Arbiscan:");
    console.log("https://sepolia.arbiscan.io/tx/" + txHash);
}

main().catch(console.error);