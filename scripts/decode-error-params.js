const { ethers } = require("hardhat");

const errorData = "0xe73a05d500000000000000000000000000000000000000000000000000000000001153390000000000000000000000000000000000000000000000000000000000124f80";

console.log("Error Data:", errorData);
console.log("Error Selector:", errorData.slice(0, 10));

// Decode the parameters assuming it's (uint256, uint256)
const abiCoder = ethers.utils.defaultAbiCoder;
const params = errorData.slice(10); // Remove 0x and selector

const decoded = abiCoder.decode(['uint256', 'uint256'], '0x' + params);

console.log("\nDecoded Parameters (assuming uint256, uint256):");
console.log("Param 1:", decoded[0].toString());
console.log("Param 2:", decoded[1].toString());

console.log("\nIn USD (30 decimals):");
console.log("Param 1:", ethers.utils.formatUnits(decoded[0], 30), "USD");
console.log("Param 2:", ethers.utils.formatUnits(decoded[1], 30), "USD");

console.log("\nFrom your order:");
console.log("Size Delta USD: 2484.38");
console.log("Collateral Amount: 99378907 (raw, in token decimals)");

