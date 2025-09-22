const { ethers } = require("hardhat");

async function main() {
    console.log("=== Verifying Execution Result ===\n");

    const txHash = "0x8948f016c587ec5699fdab288a3ebd93a622a85da4854cf059b6b28560ce80a2";
    const [signer] = await ethers.getSigners();

    // Contract addresses
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const DEPOSIT_KEY = "0xdca93e68f3d0f9c137afa6ee3c0d624dd0c39c829ae6ec1eff1a4fb442df05a4";

    const usdt = await ethers.getContractAt("IERC20", USDT);
    const marketToken = await ethers.getContractAt("IERC20", MARKET);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("1️⃣ CHECKING TRANSACTION EVENTS...");
    const receipt = await ethers.provider.getTransactionReceipt(txHash);

    console.log("  Transaction Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("  Gas Used:", receipt.gasUsed.toString());
    console.log("  Events:", receipt.logs.length);

    // Check for USDT Transfer events
    const transferTopic = ethers.utils.id("Transfer(address,address,uint256)");

    console.log("\n2️⃣ ANALYZING USDT TRANSFERS...");
    for (const log of receipt.logs) {
        if (log.topics[0] === transferTopic && log.address.toLowerCase() === USDT.toLowerCase()) {
            const from = ethers.utils.getAddress("0x" + log.topics[1].slice(26));
            const to = ethers.utils.getAddress("0x" + log.topics[2].slice(26));
            const amount = ethers.utils.defaultAbiCoder.decode(["uint256"], log.data)[0];

            console.log("\n  💸 USDT Transfer Found:");
            console.log("    From:", from);
            console.log("    To:", to);
            console.log("    Amount:", ethers.utils.formatUnits(amount, 6), "USDT");

            if (from === DEPOSIT_VAULT && to === signer.address) {
                console.log("    ⚠️ THIS IS A REFUND! USDT returned to your wallet!");
                console.log("    ❌ DEPOSIT WAS CANCELLED, NOT EXECUTED!");
            }
        }
    }

    // Check market token transfers
    console.log("\n3️⃣ CHECKING MARKET TOKEN TRANSFERS...");
    let marketTokensMinted = false;
    for (const log of receipt.logs) {
        if (log.topics[0] === transferTopic && log.address.toLowerCase() === MARKET.toLowerCase()) {
            marketTokensMinted = true;
            const from = ethers.utils.getAddress("0x" + log.topics[1].slice(26));
            const to = ethers.utils.getAddress("0x" + log.topics[2].slice(26));
            const amount = ethers.utils.defaultAbiCoder.decode(["uint256"], log.data)[0];

            console.log("  Market Token Transfer:");
            console.log("    From:", from);
            console.log("    To:", to);
            console.log("    Amount:", ethers.utils.formatEther(amount));
        }
    }

    if (!marketTokensMinted) {
        console.log("  ❌ No market token transfers found - NO TOKENS MINTED!");
    }

    console.log("\n4️⃣ CHECKING CURRENT BALANCES...");

    // Check your USDT balance
    const yourUsdtBalance = await usdt.balanceOf(signer.address);
    console.log("  Your USDT balance:", ethers.utils.formatUnits(yourUsdtBalance, 6), "USDT");

    // Check DepositVault balance
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  DepositVault USDT:", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Check market balance
    const marketBalance = await usdt.balanceOf(MARKET);
    console.log("  Market USDT:", ethers.utils.formatUnits(marketBalance, 6), "USDT");

    // Check market token supply
    const marketTokenSupply = await marketToken.totalSupply();
    console.log("  Market Token Supply:", ethers.utils.formatEther(marketTokenSupply));

    // Check pool amount
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
    console.log("  Pool USDT Amount:", ethers.utils.formatUnits(poolAmount, 6), "USDT");

    // Check if deposit still exists
    console.log("\n5️⃣ CHECKING DEPOSIT STATUS...");
    const READER = "0x4bD6A4cC827779EDE670790a2ee526Fd083703b3";
    const reader = await ethers.getContractAt("Reader", READER);

    try {
        const deposit = await reader.getDeposit(DATA_STORE, DEPOSIT_KEY);
        console.log("  ❌ Deposit still exists - was NOT executed!");
    } catch {
        console.log("  ✅ Deposit no longer exists - was processed");
    }

    console.log("\n\n=== VERDICT ===");

    if (poolAmount.eq(0) && marketTokenSupply.eq(0)) {
        console.log("❌ DEPOSIT WAS CANCELLED AGAIN!");
        console.log("   - Your USDT was refunded");
        console.log("   - No market tokens were minted");
        console.log("   - No liquidity added to pool");
        console.log("   - The market is still NOT initialized");
        console.log("\n💡 The execution succeeded but the deposit was cancelled during processing");
        console.log("   This indicates an error in the deposit execution logic");
    } else {
        console.log("✅ DEPOSIT WAS EXECUTED SUCCESSFULLY!");
        console.log("   - Pool has", ethers.utils.formatUnits(poolAmount, 6), "USDT");
        console.log("   - Market tokens minted:", ethers.utils.formatEther(marketTokenSupply));
    }
}

main().catch(console.error);