const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const selector = "0xe73a05d5";

    // Read all error definitions from Errors.sol
    const errorsContent = fs.readFileSync("./contracts/error/Errors.sol", "utf8");
    const errorRegex = /error\s+(\w+)\s*\(([^)]*)\)/g;

    let match;
    while ((match = errorRegex.exec(errorsContent)) !== null) {
        const errorName = match[1];
        const params = match[2].trim();

        // Compute selector
        let paramTypes = [];
        if (params) {
            paramTypes = params.split(',').map(p => p.trim().split(' ')[0]);
        }
        const signature = errorName + "(" + paramTypes.join(',') + ")";
        const computedSelector = ethers.utils.id(signature).slice(0, 10);

        if (computedSelector === selector) {
            console.log("\n✅ FOUND ERROR: " + errorName);
            console.log("   Signature: " + signature);
            console.log("   Params: " + params);
            console.log("   Selector: " + computedSelector);

            // Now decode the actual values
            const reasonBytes = "0xe73a05d50000000000000000000000000000000000000000000000000000000000108daa0000000000000000000000000000000000000000000000000000000000124f80";
            const abiCoder = new ethers.utils.AbiCoder();

            // Remove selector (first 4 bytes)
            const data = "0x" + reasonBytes.slice(10);

            try {
                const decoded = abiCoder.decode(paramTypes, data);
                console.log("\n   Decoded values:");
                for (let i = 0; i < decoded.length; i++) {
                    const val = decoded[i];
                    const formatted = typeof val === 'object' && val._isBigNumber
                        ? val.toString()
                        : val;
                    console.log("     [" + i + "]: " + formatted);
                }
            } catch (e) {
                console.log("   Decode error:", e.message);
            }
        }
    }

    // Also try some common error signatures manually
    console.log("\n=== Checking common error signatures ===");
    const commonErrors = [
        "InvalidMarketTokenBalance(uint256,uint256)",
        "UnexpectedPoolValue(uint256,uint256)",
        "InsufficientPoolAmount(uint256,uint256)",
        "MaxPoolAmountExceeded(uint256,uint256)",
        "InvalidMarketTokenBalanceForCollateralAmount(uint256,uint256)",
        "InvalidMarketTokenBalanceForClaimableFunding(uint256,uint256)"
    ];

    for (const sig of commonErrors) {
        const computed = ethers.utils.id(sig).slice(0, 10);
        if (computed === selector) {
            console.log("MATCH: " + sig + " -> " + computed);
        }
    }
}

main().catch(console.error);
