const { ethers } = require("hardhat");

async function main() {
    const block = await ethers.provider.getBlock("latest");
    const jsTime = Math.floor(Date.now() / 1000);

    console.log("Block number:", block.number);
    console.log("Block timestamp:", block.timestamp);
    console.log("JavaScript time:", jsTime);
    console.log("Difference:", jsTime - block.timestamp, "seconds");
    console.log("\nJavaScript is", jsTime > block.timestamp ? "ahead" : "behind", "of blockchain");
}

main().catch(console.error);