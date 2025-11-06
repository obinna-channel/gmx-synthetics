const { ethers } = require("hardhat");
const fs = require("fs");

const errorContent = fs.readFileSync("contracts/error/Errors.sol", "utf8");
const errorMatches = errorContent.match(/error\s+\w+\([^)]*\)/g);

const targetSelector = "0xe73a05d5";

console.log(`Looking for selector: ${targetSelector}\n`);

for (const errorSig of errorMatches) {
    const selector = ethers.utils.id(errorSig).slice(0, 10);
    if (selector === targetSelector) {
        console.log("✅ FOUND:");
        console.log(`  ${errorSig}`);
        console.log(`  Selector: ${selector}`);
    }
}

console.log("\nDone.");
