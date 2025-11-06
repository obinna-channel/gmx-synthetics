const { ethers } = require("hardhat");

const errors = [
    "InvalidDecreaseOrderSize(uint256,uint256)",
    "InvalidSizeDeltaForAdl(uint256,uint256)",
    "InsufficientReservedUsd(uint256,uint256)",
    "InvalidPositionSizeValues(uint256,uint256)",
    "InsufficientLiquidity(uint256,uint256)",
    "MaxAutoCancelOrdersExceeded(uint256,uint256)",
    "RequestNotYetCancellable(uint256,uint256,string)",
];

console.log("Looking for selector: 0xe73a05d5\n");

for (const sig of errors) {
    const selector = ethers.utils.id(sig).slice(0, 10);
    console.log(selector + " " + sig);
    if (selector === "0xe73a05d5") {
        console.log("\n✅ MATCH FOUND: " + sig);
    }
}
