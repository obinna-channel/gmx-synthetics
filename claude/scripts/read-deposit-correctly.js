const { ethers } = require("hardhat");

async function main() {
    console.log("=== Reading Deposit Data Using Correct Pattern ===\n");

    const depositKey = "0xd3f52ad45997c5abb7a09ff847d4e41612029fed6bf988b887c033f4efc2e696";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    console.log("Deposit key:", depositKey);

    // Use the EXACT same pattern as DepositStoreUtils.sol
    // keccak256(abi.encode(key, FIELD))

    // Define the field constants exactly as in the contract
    const ACCOUNT = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT"]));
    const RECEIVER = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["RECEIVER"]));
    const MARKET = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["MARKET"]));
    const INITIAL_LONG_TOKEN = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_LONG_TOKEN"]));
    const INITIAL_SHORT_TOKEN = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_SHORT_TOKEN"]));
    const INITIAL_LONG_TOKEN_AMOUNT = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_LONG_TOKEN_AMOUNT"]));
    const INITIAL_SHORT_TOKEN_AMOUNT = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["INITIAL_SHORT_TOKEN_AMOUNT"]));
    const EXECUTION_FEE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["EXECUTION_FEE"]));
    const UPDATED_AT_TIME = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["UPDATED_AT_TIME"]));

    console.log("\n📍 Reading deposit fields:");

    // Account - keccak256(abi.encode(key, ACCOUNT))
    const accountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, ACCOUNT])
    );
    const account = await dataStore.getAddress(accountKey);
    console.log("Account:", account);

    // Receiver
    const receiverKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, RECEIVER])
    );
    const receiver = await dataStore.getAddress(receiverKey);
    console.log("Receiver:", receiver);

    // Market
    const marketKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, MARKET])
    );
    const market = await dataStore.getAddress(marketKey);
    console.log("Market:", market);

    // Initial Long Token
    const longTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_LONG_TOKEN])
    );
    const longToken = await dataStore.getAddress(longTokenKey);
    console.log("Initial Long Token:", longToken);
    if (longToken === "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6") {
        console.log("  (USDT)");
    }

    // Initial Short Token
    const shortTokenKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_SHORT_TOKEN])
    );
    const shortToken = await dataStore.getAddress(shortTokenKey);
    console.log("Initial Short Token:", shortToken);

    // Initial Long Token Amount
    const longAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_LONG_TOKEN_AMOUNT])
    );
    const longAmount = await dataStore.getUint(longAmountKey);
    console.log("Initial Long Token Amount:", longAmount.toString());
    if (longAmount.gt(0) && longToken === "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6") {
        console.log("  =", ethers.utils.formatUnits(longAmount, 6), "USDT");
    }

    // Initial Short Token Amount
    const shortAmountKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, INITIAL_SHORT_TOKEN_AMOUNT])
    );
    const shortAmount = await dataStore.getUint(shortAmountKey);
    console.log("Initial Short Token Amount:", shortAmount.toString());
    if (shortAmount.gt(0)) {
        console.log("  =", ethers.utils.formatUnits(shortAmount, 18), "sNGN");
    }

    // Execution Fee
    const execFeeKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, EXECUTION_FEE])
    );
    const execFee = await dataStore.getUint(execFeeKey);
    console.log("Execution Fee:", execFee.toString());
    if (execFee.gt(0)) {
        console.log("  =", ethers.utils.formatEther(execFee), "ETH");
    }

    // Updated At Time
    const updatedAtKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [depositKey, UPDATED_AT_TIME])
    );
    const updatedAt = await dataStore.getUint(updatedAtKey);
    console.log("Updated At Time:", updatedAt.toString());
    if (updatedAt.gt(0)) {
        console.log("  =", new Date(updatedAt.toNumber() * 1000).toISOString());
    }

    console.log("\n📝 Summary:");
    if (longAmount.eq(1000000) && longToken.toLowerCase() === "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6".toLowerCase()) {
        console.log("✅ Found it! The deposit has 1 USDT recorded!");
        console.log("This explains why cancellation wants to refund 1 USDT");
    } else if (account === ethers.constants.AddressZero) {
        console.log("❌ Deposit data appears to be all zeros/corrupted");
    }
}

main().catch(console.error);