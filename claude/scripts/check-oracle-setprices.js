const { ethers } = require("hardhat");

async function main() {
    console.log("=== Understanding Oracle.setPrices() ===\n");
    
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    
    // Get current block
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("Current block:", currentBlock.number);
    console.log("Current timestamp:", currentBlock.timestamp);
    
    console.log("\n📝 Oracle.setPrices() expects SetPricesParams:");
    console.log("  struct SetPricesParams {");
    console.log("    address[] tokens;");
    console.log("    address[] providers;");
    console.log("    bytes[] data;");
    console.log("  }");
    
    console.log("\nThe 'data' field should contain encoded price info including:");
    console.log("  - Token prices (min/max)");
    console.log("  - Block numbers");
    console.log("  - Timestamps");
    console.log("  - Signatures (if MIN_ORACLE_SIGNERS > 0)");
    
    console.log("\n💡 The issue:");
    console.log("When we pass empty oracleParams to executeDeposit:");
    console.log("  tokens: []");
    console.log("  providers: []");
    console.log("  data: []");
    
    console.log("\nThe Oracle uses its existing internal state, which has:");
    console.log("  - Our fresh prices from setPrimaryPrice() ✅");
    console.log("  - But OLD block numbers from previous operations ❌");
    
    console.log("\n🔧 Solution:");
    console.log("We need to pass proper oracleParams with current block numbers.");
    console.log("Even with MIN_ORACLE_SIGNERS=0, we still need valid block numbers.");
    
    // Let's build proper params
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";
    
    console.log("\n📝 Building proper OracleParams for deposit execution:");
    
    // Get the prices we set
    const usdtPrice = ethers.BigNumber.from(10).pow(24);
    const sngnPrice = ethers.BigNumber.from(10).pow(9).mul(2).div(3);
    
    // Build the compacted values
    // The Oracle expects compacted values with block numbers
    console.log("\nEncoding price data with current block numbers...");
    
    // Format for compacted values (this is GMX V2 format)
    // Includes: minPrice, maxPrice, blockNumber, timestamp
    const encodeCompactedPrice = (price, blockNumber, timestamp) => {
        // GMX uses a specific bit packing format
        // For simplicity with MIN_ORACLE_SIGNERS=0, we can use simpler encoding
        return ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256", "uint256", "uint256"],
            [price, price, blockNumber, timestamp]
        );
    };
    
    const usdtData = encodeCompactedPrice(usdtPrice, currentBlock.number, currentBlock.timestamp);
    const sngnData = encodeCompactedPrice(sngnPrice, currentBlock.number, currentBlock.timestamp);
    
    console.log("\nProper oracleParams structure:");
    console.log("{");
    console.log("  tokens: [", USDT, ",");
    console.log("          ", sNGN, "],");
    console.log("  providers: [], // Empty with MIN_ORACLE_SIGNERS=0");
    console.log("  data: [");
    console.log("    // USDT data with block", currentBlock.number);
    console.log("    '", usdtData.slice(0, 66), "...'");
    console.log("    // sNGN data with block", currentBlock.number);  
    console.log("    '", sngnData.slice(0, 66), "...'");
    console.log("  ]");
    console.log("}");
    
    console.log("\n⚠️  Note: The exact encoding format matters!");
    console.log("GMX V2 Oracle may expect a specific bit-packing format.");
}

main().catch(console.error);