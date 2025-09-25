const { ethers } = require("hardhat");

async function main() {
    console.log("=== Decoding Deposit Event ===\n");

    const txHash = "0x2306242353533d49c322a1124b103513aed275556efc504a135d29c993779ed2";
    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
        console.log("Transaction not found!");
        return;
    }

    console.log("Transaction hash:", txHash);
    console.log("Block:", receipt.blockNumber);
    console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");

    // The EventLog2 signature
    const eventLog2Topic = ethers.utils.id("EventLog2(address,string,string,bytes32,bytes32,(((string,address)[]),((string,address)[]),(((string,address),uint256)[]),((string,uint256)[]),((string,int256)[]),((string,bool)[])))");

    console.log("\n📢 Raw Event Data:");
    for (const log of receipt.logs) {
        console.log("\nContract:", log.address);
        console.log("Topics:");
        for (let i = 0; i < log.topics.length; i++) {
            console.log(`  [${i}]:`, log.topics[i]);
        }

        // Check if this is our EventLog2 event
        if (log.topics[0] === eventLog2Topic) {
            console.log("\n✅ Found EventLog2 event!");

            // Topics breakdown:
            // topics[0] = event signature hash
            // topics[1] = msgSender (indexed)
            // topics[2] = keccak256(eventName1) (indexed)
            // topics[3] = keccak256(eventName2) (indexed)

            const msgSender = ethers.utils.defaultAbiCoder.decode(["address"], log.topics[1])[0];
            console.log("Message Sender:", msgSender);

            // Decode the event names from topics
            const eventName1Hash = log.topics[2];
            const eventName2Hash = log.topics[3];

            // Common event names in GMX
            const eventNames = [
                "DepositCreated",
                "DepositExecuted",
                "DepositCancelled",
                "OrderCreated",
                "OrderExecuted",
                "OrderCancelled"
            ];

            console.log("\nChecking event name hashes:");
            for (const name of eventNames) {
                const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name));
                if (hash === eventName1Hash) {
                    console.log("  Event Name 1:", name);
                }
                if (hash === eventName2Hash) {
                    console.log("  Event Name 2:", name);
                }
            }

            // The event data contains the deposit key
            console.log("\nEvent topic hashes:");
            console.log("  Topic 2:", log.topics[2]);
            console.log("  Topic 3 (deposit key?):", log.topics[3]);

            // Topic 3 might be the deposit key
            console.log("\n🔑 Possible Deposit Key:", log.topics[3]);
        }

        if (log.data && log.data !== "0x") {
            console.log("Data (first 200 chars):", log.data.substring(0, 200) + "...");
        }
    }

    // Now let's check if the deposit is stored under a different key structure
    console.log("\n\n=== Checking Deposit Storage ===");

    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const DEPOSIT_VAULT = "0x149A382b27BF4D9DE20142d3E22d0933c9f8C794";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const usdt = await ethers.getContractAt("IERC20", USDT);

    // Check DepositVault balance
    console.log("DepositVault USDT balance:");
    const vaultBalance = await usdt.balanceOf(DEPOSIT_VAULT);
    console.log("  ", ethers.utils.formatUnits(vaultBalance, 6), "USDT");

    // Try to access the deposit using the key from the event
    const possibleDepositKey = receipt.logs[0].topics[3];
    console.log("\nTrying to read deposit with key:", possibleDepositKey);

    const READER = "0xED0Ad83195A59E45B27900ebEfa988BfCdDca12f";
    const reader = await ethers.getContractAt("Reader", READER);

    try {
        const deposit = await reader.getDeposit(DATA_STORE, possibleDepositKey);
        console.log("\n✅ DEPOSIT FOUND!");
        console.log("  Account:", deposit.addresses.account);
        console.log("  Receiver:", deposit.addresses.receiver);
        console.log("  Market:", deposit.addresses.market);
        console.log("  Initial Long Token:", deposit.addresses.initialLongToken);
        console.log("  Initial Short Token:", deposit.addresses.initialShortToken);
        console.log("  Long Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
        console.log("  Short Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");
        console.log("  Min Market Tokens:", deposit.numbers.minMarketTokens.toString());
        console.log("  Execution Fee:", ethers.utils.formatEther(deposit.numbers.executionFee), "ETH");
        console.log("  Updated At Block:", deposit.numbers.updatedAtBlock.toString());
        console.log("  Callback Gas Limit:", deposit.numbers.callbackGasLimit.toString());
    } catch (error) {
        console.log("❌ Could not read deposit with that key:", error.message);

        // Try alternative approach - check account deposit list
        const [signer] = await ethers.getSigners();
        const ACCOUNT_DEPOSIT_LIST = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_DEPOSIT_LIST"])
        );

        const accountKey = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [ACCOUNT_DEPOSIT_LIST, signer.address]
            )
        );

        try {
            const accountDepositCount = await dataStore.getBytes32Count(accountKey);
            console.log("\nDeposits for account", signer.address + ":", accountDepositCount.toString());
        } catch (e) {
            console.log("Could not check account deposits:", e.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });