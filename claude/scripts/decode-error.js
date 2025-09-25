const { ethers } = require("hardhat");

async function main() {
    console.log("=== Decoding Error ===\n");
    
    const errorData = "0xa35b150b000000000000000000000000bab0d0892bf8563b731f8e8970fe856ce93082920000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000c4f524445525f4b45455045520000000000000000000000000000000000000000";
    
    // The error signature a35b150b is for Unauthorized(address,string)
    console.log("Error signature:", errorData.slice(0, 10));
    console.log("Error type: Unauthorized(address,string)\n");
    
    // Decode the parameters
    const types = ["address", "string"];
    const decoded = ethers.utils.defaultAbiCoder.decode(types, "0x" + errorData.slice(10));
    
    console.log("Decoded error:");
    console.log("  Address:", decoded[0]);
    console.log("  Required role:", decoded[1]);
    
    // The role is ORDER_KEEPER
    const roleBytes = ethers.utils.toUtf8Bytes(decoded[1]);
    const roleHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [decoded[1]]));
    
    console.log("\n📍 Error explanation:");
    console.log("  Your address:", decoded[0]);
    console.log("  Needs role:", decoded[1]);
    console.log("  Role hash:", roleHash);
    
    console.log("\n❌ You need ORDER_KEEPER role to execute deposits!");
    console.log("The DepositHandler requires ORDER_KEEPER role, not CONTROLLER.");
}

main().catch(console.error);