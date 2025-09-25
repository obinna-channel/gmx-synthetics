const { ethers } = require("hardhat");

async function main() {
    console.log("=== INVESTIGATING DEPOSIT CREATION TRANSACTION ===\n");

    const txHash = "0x9ae398e6f284f83270f207eb7781fdc851f9ad9473a6d46553e987c8f665e470";
    const EXCHANGE_ROUTER = "0x59b94d5B4686D59a4665d1679A8E27F71c544F40";
    const DATA_STORE = "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da";

    console.log("Transaction hash:", txHash);

    const provider = ethers.provider;

    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    console.log("\n=== TRANSACTION DETAILS ===");
    console.log("From:", tx.from);
    console.log("To:", tx.to);
    console.log("Block:", receipt.blockNumber);
    console.log("Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Decode the function call
    console.log("\n=== FUNCTION CALLED ===");
    if (tx.to.toLowerCase() === EXCHANGE_ROUTER.toLowerCase()) {
        console.log("Called ExchangeRouter");

        // Check if it's createDeposit
        const createDepositSig = ethers.utils.id("createDeposit(((address,address,address,address,address,address,address[],address[]),uint256,bool,uint256,uint256,bytes32[]))").slice(0, 10);
        const methodId = tx.data.slice(0, 10);

        if (methodId === createDepositSig) {
            console.log("✅ Confirmed: createDeposit was called");
        } else {
            console.log("Method signature:", methodId);
        }
    }

    console.log("\n=== ANALYZING LOGS ===");
    console.log("Total logs emitted:", receipt.logs.length);

    for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`\n--- Log ${i} ---`);
        console.log("Contract:", log.address);
        console.log("Topics count:", log.topics.length);

        // Try to identify the event
        const eventSignatures = {
            [ethers.utils.id("DepositCreated(bytes32,address,address,address,address,uint256,uint256)")]: "DepositCreated",
            [ethers.utils.id("EventLog1(address,string,bytes32,(((address[],address[],address[],address[]),address[]),((uint256[],uint256[],uint256[],uint256[]),uint256[]),((int256[],int256[],int256[],int256[]),int256[]),((bool[],bool[],bool[],bool[]),bool[]),(bytes32[],bytes32[],bytes32[],bytes32[]),(bytes[],bytes[],bytes[],bytes[]),(string[],string[],string[],string[])))")]: "EventLog1",
            [ethers.utils.id("EventLog2(address,address,string,bytes32,bytes32,(((address[],address[],address[],address[]),address[]),((uint256[],uint256[],uint256[],uint256[]),uint256[]),((int256[],int256[],int256[],int256[]),int256[]),((bool[],bool[],bool[],bool[]),bool[]),(bytes32[],bytes32[],bytes32[],bytes32[]),(bytes[],bytes[],bytes[],bytes[]),(string[],string[],string[],string[])))")]: "EventLog2",
            [ethers.utils.id("Transfer(address,address,uint256)")]: "Transfer",
        };

        const eventType = eventSignatures[log.topics[0]] || "Unknown";
        console.log("Event type:", eventType);

        if (log.topics.length > 1) {
            console.log("Topic[1]:", log.topics[1]);
        }
        if (log.topics.length > 2) {
            console.log("Topic[2]:", log.topics[2]);
        }
        if (log.topics.length > 3) {
            console.log("Topic[3]:", log.topics[3]);
        }

        // If there's data, show its length
        if (log.data && log.data !== "0x") {
            console.log("Data length:", (log.data.length - 2) / 2, "bytes");
        }
    }

    // Check what the potential deposit key points to
    console.log("\n=== CHECKING POTENTIAL DEPOSIT KEY ===");
    const potentialKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";
    console.log("Checking key:", potentialKey);

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Try different ways the deposit might be stored
    const checks = [
        { name: "ACCOUNT", key: "ACCOUNT" },
        { name: "RECEIVER", key: "RECEIVER" },
        { name: "MARKET", key: "MARKET" },
        { name: "INITIAL_LONG_TOKEN", key: "INITIAL_LONG_TOKEN" },
        { name: "INITIAL_LONG_TOKEN_AMOUNT", key: "INITIAL_LONG_TOKEN_AMOUNT" },
        { name: "EXECUTION_FEE", key: "EXECUTION_FEE" },
        { name: "CREATED_AT_TIME", key: "CREATED_AT_TIME" }
    ];

    let depositFound = false;

    for (const check of checks) {
        const storageKey = ethers.utils.keccak256(
            ethers.utils.solidityPack(
                ["bytes32", "bytes32"],
                [potentialKey, ethers.utils.keccak256(ethers.utils.toUtf8Bytes(check.key))]
            )
        );

        // Try as address
        try {
            const value = await dataStore.getAddress(storageKey);
            if (value !== ethers.constants.AddressZero) {
                console.log(`✅ ${check.name}:`, value);
                depositFound = true;
            }
        } catch {}

        // Try as uint
        try {
            const value = await dataStore.getUint(storageKey);
            if (value.gt(0)) {
                console.log(`✅ ${check.name}:`, value.toString());
                depositFound = true;
            }
        } catch {}
    }

    if (!depositFound) {
        console.log("❌ No deposit data found with this key");
    }

    console.log("\n=== POSSIBLE EXPLANATIONS ===");
    console.log("1. The deposit was created but immediately cancelled in the same block");
    console.log("2. The deposit key is different from what we extracted");
    console.log("3. The deposit is stored with a different key structure");
    console.log("4. There was an issue with the deposit creation that we're not seeing");

    // Check if ExchangeRouter actually forwarded to DepositHandler
    console.log("\n=== CHECKING IF DEPOSIT WAS FORWARDED ===");
    const DEPOSIT_HANDLER = "0x3Bc412Ad515432cb3ddbD74bf1792971b156c827";

    let depositHandlerInvolved = false;
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === DEPOSIT_HANDLER.toLowerCase()) {
            console.log("✅ DepositHandler was involved in the transaction");
            depositHandlerInvolved = true;
            break;
        }
    }

    if (!depositHandlerInvolved) {
        console.log("⚠️ DepositHandler doesn't appear in the logs");
        console.log("The deposit might not have been properly forwarded");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });