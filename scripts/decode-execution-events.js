const { ethers } = require("hardhat");

async function main() {
    console.log("=== Decoding Deposit Execution Events ===\n");

    const txHash = "0x5b98ed6e316ea4885e3b96d5071492aeef135ab3fd50959a5ed88c08ab20e70c";
    const receipt = await ethers.provider.getTransactionReceipt(txHash);

    console.log("Transaction:", txHash);
    console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Events:", receipt.logs.length);

    // Decode each event
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`\n📢 Event ${i + 1}:`);
        console.log("  Contract:", log.address);
        console.log("  Topics:");
        for (let j = 0; j < log.topics.length; j++) {
            console.log(`    [${j}]:`, log.topics[j]);
        }

        // Check if this is an EventLog2 event
        const eventLog2Signature = ethers.utils.id("EventLog2(address,string,string,bytes32,bytes32,(((string,address)[]),((string,address)[]),(((string,address),uint256)[]),((string,uint256)[]),((string,int256)[]),((string,bool)[])))");

        if (log.topics[0] === eventLog2Signature) {
            console.log("\n  ✅ This is an EventLog2 event");

            // Decode the indexed parameters
            const msgSender = ethers.utils.defaultAbiCoder.decode(["address"], log.topics[1])[0];
            console.log("  Message Sender:", msgSender);

            // The event names are hashed in topics[2] and topics[3]
            const eventName1Hash = log.topics[2];
            const eventName2Hash = log.topics[3];

            // Common event names to check
            const eventNames = [
                "DepositCreated",
                "DepositExecuted",
                "DepositCancelled",
                "MarketPoolValueUpdated",
                "PositionImpactPoolDistributed",
                "SwapInfo",
                "FundingFees"
            ];

            console.log("\n  Checking event name hashes:");
            for (const name of eventNames) {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name));
                if (hash === eventName1Hash) {
                    console.log("    Event Name 1: 🎯", name);
                }
                if (hash === eventName2Hash) {
                    console.log("    Event Name 2: 🎯", name);
                }
            }

            // If it's a deposit event, decode the key
            if (eventName2Hash) {
                console.log("\n  Event Key (deposit/order key):", eventName2Hash);
            }

            // Check data length
            if (log.data && log.data !== "0x") {
                console.log("  Data length:", log.data.length, "chars");

                // Try to decode some basic info from the data
                try {
                    // The data contains structured information about addresses, uints, etc.
                    console.log("  Data preview (first 200 chars):", log.data.substring(0, 200) + "...");
                } catch (e) {
                    console.log("  Could not decode data:", e.message);
                }
            }
        }
    }

    // Check where the USDT went
    console.log("\n\n💰 CHECKING USDT TRANSFERS...");

    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Look for Transfer events in the logs
    const transferSignature = ethers.utils.id("Transfer(address,address,uint256)");

    for (const log of receipt.logs) {
        if (log.topics[0] === transferSignature && log.address.toLowerCase() === USDT.toLowerCase()) {
            const from = ethers.utils.defaultAbiCoder.decode(["address"], log.topics[1])[0];
            const to = ethers.utils.defaultAbiCoder.decode(["address"], log.topics[2])[0];
            const amount = ethers.utils.defaultAbiCoder.decode(["uint256"], log.data)[0];

            console.log("\n  💸 USDT Transfer:");
            console.log("    From:", from);
            console.log("    To:", to);
            console.log("    Amount:", ethers.utils.formatUnits(amount, 6), "USDT");
        }
    }

    // Check final balances
    console.log("\n\n📊 FINAL BALANCE CHECK:");

    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";

    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    const marketBalance = await usdt.balanceOf(MARKET);

    console.log("  DepositVault USDT:", ethers.utils.formatUnits(vaultBalance, 6));
    console.log("  Market USDT:", ethers.utils.formatUnits(marketBalance, 6));

    // Check other potential holding addresses
    const potentialHolders = [
        ["0x0000000000000000000000000000000000000001", "address(1)"],
        ["0xBaB0D0892Bf8563B731f8e8970fE856ce9308292", "Your account"]
    ];

    for (const [address, name] of potentialHolders) {
        const balance = await usdt.balanceOf(address);
        if (balance.gt(0)) {
            console.log(`  ${name} USDT:`, ethers.utils.formatUnits(balance, 6));
        }
    }
}

main().catch(console.error);