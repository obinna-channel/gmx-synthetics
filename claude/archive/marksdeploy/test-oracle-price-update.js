const { ethers } = require("hardhat");

async function main() {
    console.log("Testing Oracle price update...\n");
    
    const oracleAddress = "0x1bFA17439e7f91Ee7F7d464FB8B5666D454492E7";
    const [signer] = await ethers.getSigners();
    console.log("Signer:", signer.address);
    
    // Full Oracle ABI for setPrices
    const oracleABI = [
        {
            "inputs": [
                {
                    "components": [
                        {"internalType": "uint256", "name": "signerInfo", "type": "uint256"},
                        {"internalType": "address[]", "name": "tokens", "type": "address[]"},
                        {"internalType": "uint256[]", "name": "compactedMinOracleBlockNumbers", "type": "uint256[]"},
                        {"internalType": "uint256[]", "name": "compactedMaxOracleBlockNumbers", "type": "uint256[]"},
                        {"internalType": "uint256[]", "name": "compactedOracleTimestamps", "type": "uint256[]"},
                        {"internalType": "uint256[]", "name": "compactedDecimals", "type": "uint256[]"},
                        {"internalType": "uint256[]", "name": "compactedMinPrices", "type": "uint256[]"},
                        {"internalType": "uint256[]", "name": "compactedMinPricesIndexes", "type": "uint256[]"},
                        {"internalType": "uint256[]", "name": "compactedMaxPrices", "type": "uint256[]"},
                        {"internalType": "uint256[]", "name": "compactedMaxPricesIndexes", "type": "uint256[]"},
                        {"internalType": "bytes[]", "name": "signatures", "type": "bytes[]"},
                        {"internalType": "address[]", "name": "priceFeedTokens", "type": "address[]"},
                        {"internalType": "address[]", "name": "realtimeFeedTokens", "type": "address[]"},
                        {"internalType": "bytes[]", "name": "realtimeFeedData", "type": "bytes[]"}
                    ],
                    "internalType": "struct OracleUtils.SetPricesParams",
                    "name": "params",
                    "type": "tuple"
                }
            ],
            "name": "setPrices",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
            "name": "getPrimaryPrice",
            "outputs": [
                {
                    "components": [
                        {"internalType": "uint256", "name": "min", "type": "uint256"},
                        {"internalType": "uint256", "name": "max", "type": "uint256"}
                    ],
                    "internalType": "struct Price.Props",
                    "name": "",
                    "type": "tuple"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];
    
    const oracle = await ethers.getContractAt(oracleABI, oracleAddress);
    
    // Test with a single token first (NGN)
    const ngnToken = "0x0000000000000000000000000000000000000001";
    const price = ethers.utils.parseUnits("1500", 30); // 1500 with 30 decimals
    
    // Get current block info
    const block = await ethers.provider.getBlock("latest");
    console.log("Current block number:", block.number);
    console.log("Current timestamp:", block.timestamp);
    
    // Create minimal params for one token
    const params = {
        signerInfo: 1, // 1 signer at index 0
        tokens: [ngnToken],
        compactedMinOracleBlockNumbers: [block.number],
        compactedMaxOracleBlockNumbers: [block.number],
        compactedOracleTimestamps: [block.timestamp],
        compactedDecimals: [30],
        compactedMinPrices: [price],
        compactedMinPricesIndexes: [0],
        compactedMaxPrices: [price],
        compactedMaxPricesIndexes: [0],
        signatures: ["0x"], // Empty signature
        priceFeedTokens: [],
        realtimeFeedTokens: [],
        realtimeFeedData: []
    };
    
    console.log("\n=== PARAMS ===");
    console.log("signerInfo:", params.signerInfo);
    console.log("tokens:", params.tokens);
    console.log("block numbers:", params.compactedMinOracleBlockNumbers[0]);
    console.log("timestamp:", params.compactedOracleTimestamps[0]);
    console.log("price:", params.compactedMinPrices[0].toString());
    
    console.log("\n=== ATTEMPTING PRICE UPDATE ===");
    
    try {
        // First try to estimate gas
        console.log("Estimating gas...");
        const gasEstimate = await oracle.estimateGas.setPrices(params);
        console.log("Gas estimate:", gasEstimate.toString());
        
        // If gas estimation works, send the transaction
        console.log("\nSending transaction...");
        const tx = await oracle.setPrices(params, {
            gasLimit: gasEstimate.mul(120).div(100) // 20% buffer
        });
        
        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Transaction mined!");
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Verify price was set
        console.log("\n=== VERIFYING PRICE ===");
        const priceResult = await oracle.getPrimaryPrice(ngnToken);
        console.log("NGN min price:", ethers.utils.formatUnits(priceResult[0], 30));
        console.log("NGN max price:", ethers.utils.formatUnits(priceResult[1], 30));
        
    } catch (error) {
        console.log("\n❌ Error:", error.message);
        
        if (error.error && error.error.data) {
            console.log("Error data:", error.error.data);
            
            // Try to decode common errors
            const errorSignatures = {
                "0x815e1d64": "EmptyPrimaryPrice",
                "0xcd64a025": "EmptyPrimaryPrice(address)",
                "0xa35b150b": "Unauthorized(address,string)",
                "0x3e237976": "NonEmptyTokensWithPrices",
                "0x5cb045db": "MinOracleSigners",
                "0x39d35496": "MaxOracleSigners",
                "0x2a35ba7f": "InvalidSignature",
                "0x4721e878": "InvalidSigner",
                "0x": "Generic revert with no message"
            };
            
            const errorSelector = error.error.data.slice(0, 10);
            if (errorSignatures[errorSelector]) {
                console.log("Likely error:", errorSignatures[errorSelector]);
            }
        }
        
        // Try alternative approach - maybe we need to clear prices first?
        console.log("\n=== CHECKING CONTRACT STATE ===");
        
        // Check if Oracle has a clearAllPrices function
        try {
            const clearABI = ["function clearAllPrices() external"];
            const oracleWithClear = await ethers.getContractAt([...oracleABI, ...clearABI], oracleAddress);
            
            console.log("Attempting to clear all prices first...");
            const clearTx = await oracleWithClear.clearAllPrices();
            await clearTx.wait();
            console.log("Prices cleared, retrying setPrices...");
            
            // Retry after clearing
            const retryTx = await oracle.setPrices(params);
            await retryTx.wait();
            console.log("✅ Success after clearing prices!");
            
        } catch (clearError) {
            console.log("Clear prices approach didn't work:", clearError.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });