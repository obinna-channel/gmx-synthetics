const { ethers } = require("hardhat");

async function main() {
    const errorData = "0xa35b150b000000000000000000000000bab0d0892bf8563b731f8e8970fe856ce93082920000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000d524f555445525f504c5547494e00000000000000000000000000000000000000";

    // The error signature is 0xa35b150b which doesn't match the standard Unauthorized error
    // Let's decode the data manually

    console.log("Error signature:", errorData.slice(0, 10));

    // Skip the function selector (first 4 bytes = 10 chars including 0x)
    const params = errorData.slice(10);

    // Decode the parameters
    // First 32 bytes (64 chars) is the address
    const address = "0x" + params.slice(24, 64); // Skip padding, get last 20 bytes
    console.log("Account:", address);

    // Next 32 bytes is offset to string (should be 0x40 = 64)
    const offset = params.slice(64, 128);
    console.log("Offset:", "0x" + offset);

    // Next 32 bytes is string length
    const length = parseInt(params.slice(128, 192), 16);
    console.log("String length:", length);

    // Next is the string data
    const stringHex = params.slice(192, 192 + length * 2);
    const roleString = Buffer.from(stringHex, 'hex').toString();
    console.log("Role name:", roleString);

    console.log("\n=== SUMMARY ===");
    console.log(`The account ${address} is missing the ${roleString} role`);
}

main().catch(console.error);