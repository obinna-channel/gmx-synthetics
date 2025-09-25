const { ethers } = require("hardhat");

async function main() {
    console.log("=== Decoding Cancel Error ===\n");

    const errorData = "0x979dc7800000000000000000000000005fe0ca3af9cf758d7f4159295fd1cd6a05562bb6000000000000000000000000bab0d0892bf8563b731f8e8970fe856ce930829200000000000000000000000000000000000000000000000000000000000f4240";

    const errorSig = errorData.slice(0, 10);
    console.log("Error signature:", errorSig, "= InsufficientFeeTokenAmount");

    // Decode the parameters
    const params = "0x" + errorData.slice(10);
    const decoded = ethers.utils.defaultAbiCoder.decode(
        ["address", "address", "uint256"],
        params
    );

    console.log("\nError parameters:");
    console.log("  Token:", decoded[0]);
    console.log("  Account:", decoded[1]);
    console.log("  Amount:", decoded[2].toString());

    // Token is USDT
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    if (decoded[0].toLowerCase() === USDT.toLowerCase()) {
        console.log("\n📊 Decoded:");
        console.log("  Token: USDT");
        console.log("  Account trying to receive refund:", decoded[1]);
        console.log("  Amount needed: 1 USDT (", ethers.utils.formatUnits(decoded[2], 6), ")");
        console.log("  Raw amount:", decoded[2].toString(), "(0x" + decoded[2].toHexString() + ")");
    }

    console.log("\n💡 What this means:");
    console.log("The system is trying to refund 1 USDT to", decoded[1]);
    console.log("But the vault doesn't have 1 USDT to refund");
    console.log("\n❓ This is very strange because:");
    console.log("1. The deposit shows 0 for all amounts in DataStore");
    console.log("2. But the cancellation logic thinks it needs to refund 1 USDT");
    console.log("3. This suggests the deposit data is partially corrupted");
}

main().catch(console.error);