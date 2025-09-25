const { ethers } = require("hardhat");

async function main() {
    const errorSelector = "0x01af8c24";

    console.log("Decoding error selector:", errorSelector);

    // Calculate selectors for known errors
    const errors = [
        "EmptyDepositAmounts()",
        "EmptyDepositAmountsAfterSwap()",
        "Unauthorized(address,string)",
        "EmptyMarket(address)",
        "DisabledMarket(address)",
        "InvalidReceiverForFirstDeposit(address,address)",
        "InsufficientExecutionFee(uint256,uint256)",
        "MinMarketTokens(uint256,uint256)"
    ];

    console.log("\nChecking against known errors:");
    for (const error of errors) {
        const hash = ethers.utils.id(error);
        const selector = hash.slice(0, 10);
        if (selector === errorSelector) {
            console.log(`  ✅ MATCH: ${error}`);
            console.log(`     Full hash: ${hash}`);
        } else {
            console.log(`  ${selector} - ${error}`);
        }
    }
}

main().catch(console.error);