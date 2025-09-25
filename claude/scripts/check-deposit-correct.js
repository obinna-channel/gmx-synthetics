const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Deposit Data (Correct Method) ===\n");
    
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    console.log("Deposit key:", depositKey);
    
    // Check if deposit is in the list
    const DEPOSIT_LIST = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"])
    );
    const isInList = await dataStore.containsBytes32(DEPOSIT_LIST, depositKey);
    console.log("\nIs in DEPOSIT_LIST:", isInList);
    
    // Check deposit data using the correct keys from DepositStoreUtils
    const ACCOUNT = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"]));
    const RECEIVER = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["RECEIVER"]));
    const MARKET = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET"]));
    const INITIAL_LONG_TOKEN = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_LONG_TOKEN"]));
    const INITIAL_SHORT_TOKEN = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_SHORT_TOKEN"]));
    const INITIAL_LONG_TOKEN_AMOUNT = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_LONG_TOKEN_AMOUNT"]));
    const INITIAL_SHORT_TOKEN_AMOUNT = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_SHORT_TOKEN_AMOUNT"]));
    const EXECUTION_FEE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["EXECUTION_FEE"]));
    
    // Get deposit data fields
    const account = await dataStore.getAddress(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, ACCOUNT]))
    );
    const receiver = await dataStore.getAddress(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, RECEIVER]))
    );
    const market = await dataStore.getAddress(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, MARKET]))
    );
    const longToken = await dataStore.getAddress(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_LONG_TOKEN]))
    );
    const shortToken = await dataStore.getAddress(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_SHORT_TOKEN]))
    );
    const longAmount = await dataStore.getUint(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_LONG_TOKEN_AMOUNT]))
    );
    const shortAmount = await dataStore.getUint(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_SHORT_TOKEN_AMOUNT]))
    );
    const executionFee = await dataStore.getUint(
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, EXECUTION_FEE]))
    );
    
    console.log("\nDeposit Data:");
    console.log("  Account:", account);
    console.log("  Receiver:", receiver);
    console.log("  Market:", market);
    console.log("  Long Token:", longToken);
    console.log("  Short Token:", shortToken);
    console.log("  Long Amount:", longAmount.toString());
    console.log("  Short Amount:", shortAmount.toString());
    console.log("  Execution Fee:", executionFee.toString());
    
    if (account !== ethers.constants.AddressZero) {
        console.log("\n✅ DEPOSIT DATA EXISTS!");
        if (receiver === "0x0000000000000000000000000000000000000001") {
            console.log("✅ Using address(1) as receiver - correct for first deposit!");
        }
        console.log("\nThe deposit is waiting for keeper execution.");
    } else {
        console.log("\n❌ No deposit data found.");
    }
}

main().catch(console.error);