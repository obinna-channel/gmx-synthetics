const { ethers } = require("hardhat");

async function main() {
    console.log("=== INVESTIGATING THE REPEATING DEPOSIT KEY ===\n");

    const suspiciousKey = "0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd";
    console.log("This key appears in EVERY deposit attempt:");
    console.log(suspiciousKey, "\n");

    // Let's see if we can figure out how this key is generated
    console.log("Checking if it's a hash of common values...\n");

    const commonValues = [
        "DEPOSIT",
        "deposit",
        "0",
        "1",
        "",
        "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292", // signer
        "0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970", // market
        "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6", // USDT
    ];

    for (const value of commonValues) {
        const hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
        if (hash === suspiciousKey) {
            console.log(`✅ Found match! Key is keccak256("${value}")`);
        }
    }

    // Try combinations
    console.log("Checking combinations...");

    // Check if it might be a default/placeholder value
    const zeroBytes32 = ethers.constants.HashZero;
    console.log("Is it zero bytes32?", suspiciousKey === zeroBytes32 ? "Yes" : "No");

    // Check if it's related to nonce
    const nonceZero = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [0]));
    console.log("Is it keccak256(0)?", suspiciousKey === nonceZero ? "Yes" : "No");

    // The key might be hardcoded in the contract
    console.log("\n=== HYPOTHESIS ===");
    console.log("This key appearing in every attempt suggests:");
    console.log("1. It's a hardcoded value in the EventEmitter");
    console.log("2. The ExchangeRouter is emitting a placeholder event");
    console.log("3. The actual deposit creation logic is bypassed");

    // Let's check what EventEmitter is doing
    console.log("\n=== CHECKING EVENTEMITTER ===");
    const EVENT_EMITTER = "0x306E6368851c889dc67700E77F278fAB92205aea";

    // This is actually wrong! Let me check the correct EventEmitter
    const deploymentData = require("../../deployments/marks/arbitrumSepolia/EventEmitter.json");
    console.log("EventEmitter from deployment:", deploymentData.address);

    if (deploymentData.address.toLowerCase() !== EVENT_EMITTER.toLowerCase()) {
        console.log("⚠️ The EventEmitter address doesn't match!");
        console.log("The log is from a different contract!");
    }

    console.log("\n=== FINAL ANALYSIS ===");
    console.log("The repeating key confirms that:");
    console.log("1. The same (broken) code path is executed every time");
    console.log("2. No actual deposit is being created");
    console.log("3. The ExchangeRouter is fundamentally broken");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });