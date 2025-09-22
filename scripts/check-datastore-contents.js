const { ethers } = require("hardhat");

async function main() {
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("=== Checking DataStore Contents ===\n");
    
    // Check some known keys that should have been set
    const keysToCheck = [
        // Basic configurations
        ["WNT", "address"],
        ["NONCE", "uint"],
        ["FEE_RECEIVER", "address"],
        
        // Oracle configurations (these probably failed)
        ["MIN_ORACLE_BLOCK_CONFIRMATIONS", "uint"],
        ["MAX_ORACLE_PRICE_AGE", "uint"],
        ["MIN_ORACLE_SIGNERS", "uint"],
        
        // Token transfer gas limits
        ["TOKEN_TRANSFER_GAS_LIMIT", "uint"],
        
        // Feature flags
        ["CREATE_DEPOSIT_FEATURE_DISABLED", "bool"],
        ["CANCEL_DEPOSIT_FEATURE_DISABLED", "bool"],
        ["EXECUTE_DEPOSIT_FEATURE_DISABLED", "bool"],
    ];
    
    for (const [keyName, type] of keysToCheck) {
        const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(keyName));
        
        try {
            let value;
            if (type === "address") {
                value = await dataStore.getAddress(key);
                const shortKey = key.substring(0, 10);
                console.log(keyName + " (" + shortKey + "...): " + value);
                if (value === ethers.constants.AddressZero) {
                    console.log("  Not set (zero address)");
                } else {
                    console.log("  Set");
                }
            } else if (type === "uint") {
                value = await dataStore.getUint(key);
                const shortKey = key.substring(0, 10);
                console.log(keyName + " (" + shortKey + "...): " + value.toString());
                if (value.eq(0)) {
                    console.log("  Value is 0");
                } else {
                    console.log("  Set to " + value.toString());
                }
            } else if (type === "bool") {
                value = await dataStore.getBool(key);
                const shortKey = key.substring(0, 10);
                console.log(keyName + " (" + shortKey + "...): " + value);
                console.log("  " + value);
            }
        } catch (error) {
            console.log(keyName + ": ERROR - " + error.message);
        }
        console.log("");
    }
    
    // Check if any deposits exist (from previous attempts)
    console.log("\n=== Checking for Deposits ===");
    const depositListKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEPOSIT_LIST"));
    try {
        const depositCount = await dataStore.getUint(depositListKey);
        console.log("Deposit count: " + depositCount.toString());
    } catch (e) {
        console.log("Could not check deposit count");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
