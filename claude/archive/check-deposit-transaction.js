const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Transaction ===\n");

    // The successful deposit transaction hash
    const txHash = "0x2306242353533d49c322a1124b103513aed275556efc504a135d29c993779ed2";

    console.log("Fetching transaction receipt for:", txHash);
    const provider = ethers.provider;
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
        console.log("Transaction not found!");
        return;
    }

    console.log("\n📝 Transaction Details:");
    console.log("  Block Number:", receipt.blockNumber);
    console.log("  From:", receipt.from);
    console.log("  To:", receipt.to);
    console.log("  Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log("  Gas Used:", receipt.gasUsed.toString());

    console.log("\n📢 Events Emitted:", receipt.logs.length, "events");

    // Get EventEmitter ABI
    const EVENT_EMITTER = "0x8c3c5EE6e8c03CbFa7F1076b936Ccf5a57E00122";
    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    // Parse events
    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`\nEvent ${i + 1}:`);
        console.log("  Contract:", log.address);
        console.log("  Topics:", log.topics.length);

        try {
            const parsed = eventEmitter.interface.parseLog(log);
            console.log("  Event Name:", parsed.name);

            if (parsed.name === "DepositCreated") {
                console.log("\n  🎯 DEPOSIT CREATED EVENT FOUND!");
                const depositKey = parsed.args.key;
                console.log("    Deposit Key:", depositKey);

                // Decode the event data
                if (parsed.args.eventData) {
                    console.log("    Event Data:");
                    const eventData = parsed.args.eventData;

                    // The eventData contains encoded information about the deposit
                    if (eventData.addressItems && eventData.addressItems.items) {
                        console.log("    Address Items:");
                        const addressKeys = [
                            "account", "receiver", "callbackContract", "uiFeeReceiver",
                            "market", "initialLongToken", "initialShortToken"
                        ];

                        for (let j = 0; j < eventData.addressItems.items.length && j < addressKeys.length; j++) {
                            const item = eventData.addressItems.items[j];
                            console.log(`      ${addressKeys[j]}:`, item.value);
                        }
                    }

                    if (eventData.uintItems && eventData.uintItems.items) {
                        console.log("    Uint Items:");
                        const uintKeys = [
                            "initialLongTokenAmount", "initialShortTokenAmount",
                            "minMarketTokens", "updatedAtBlock", "executionFee", "callbackGasLimit"
                        ];

                        for (let j = 0; j < eventData.uintItems.items.length && j < uintKeys.length; j++) {
                            const item = eventData.uintItems.items[j];
                            if (uintKeys[j].includes("Token")) {
                                console.log(`      ${uintKeys[j]}:`, ethers.utils.formatUnits(item.value, 6), "USDT");
                            } else if (uintKeys[j] === "executionFee") {
                                console.log(`      ${uintKeys[j]}:`, ethers.utils.formatEther(item.value), "ETH");
                            } else {
                                console.log(`      ${uintKeys[j]}:`, item.value.toString());
                            }
                        }
                    }
                }
            } else {
                console.log("  Event:", parsed.name);
                if (parsed.args.length > 0) {
                    Object.keys(parsed.args).forEach(key => {
                        if (isNaN(key)) {
                            console.log(`    ${key}:`, parsed.args[key].toString ? parsed.args[key].toString() : parsed.args[key]);
                        }
                    });
                }
            }
        } catch (error) {
            // Not an EventEmitter event
            console.log("  Raw Topics:", log.topics);
        }
    }

    // Now check the deposit in DataStore with correct address
    console.log("\n\n=== Checking Deposit in DataStore ===");
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const READER = "0xED0Ad83195A59E45B27900ebEfa988BfCdDca12f";

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const reader = await ethers.getContractAt("Reader", READER);

    // Check deposit count
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );

    try {
        const depositCount = await dataStore.getAddressCount(DEPOSIT_LIST);
        console.log("\nTotal deposits in system:", depositCount.toString());

        if (depositCount.gt(0)) {
            const depositKeys = await dataStore.getAddressValuesAt(DEPOSIT_LIST, 0, depositCount);
            console.log("Deposit keys found:", depositKeys.length);

            for (const key of depositKeys) {
                console.log("\nDeposit Key:", key);
                try {
                    const deposit = await reader.getDeposit(DATA_STORE, key);
                    console.log("  Account:", deposit.addresses.account);
                    console.log("  Receiver:", deposit.addresses.receiver);
                    console.log("  Market:", deposit.addresses.market);
                    console.log("  Long Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
                    console.log("  Short Token Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");
                    console.log("  Execution Fee:", ethers.utils.formatEther(deposit.numbers.executionFee), "ETH");
                } catch (error) {
                    console.log("  Error reading deposit:", error.message);
                }
            }
        }
    } catch (error) {
        console.log("Error accessing DataStore:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });