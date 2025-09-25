const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("=== Deploying Mock Oracle Provider ===\n");
    console.log("Deployer:", signer.address);

    // Get DataStore address
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    const ROLE_STORE = "0x4943c063691259B677f3D7BC808C9C3090321EbB";

    console.log("Using DataStore:", DATA_STORE);
    console.log("Using RoleStore:", ROLE_STORE);

    // Step 1: Deploy MockOracleProvider contract
    console.log("\n📍 Step 1: Creating MockOracleProvider contract source...");

    const mockOracleProviderSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../oracle/IOracleProvider.sol";
import "../price/Price.sol";

/**
 * @title MockOracleProvider
 * @dev Simple oracle provider for testing that returns preset prices
 */
contract MockOracleProvider is IOracleProvider {
    using Price for Price.Props;

    mapping(address => Price.Props) public prices;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "MockOracleProvider: only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function shouldAdjustTimestamp() external pure returns (bool) {
        return false;
    }

    function getOraclePrice(
        address token,
        bytes memory data
    ) external view returns (OracleUtils.ValidatedPrice memory) {
        Price.Props memory price = prices[token];
        require(price.min > 0 && price.max > 0, "MockOracleProvider: price not set");

        return OracleUtils.ValidatedPrice({
            token: token,
            min: price.min,
            max: price.max,
            timestamp: block.timestamp,
            provider: address(this)
        });
    }

    function setPrice(address token, uint256 minPrice, uint256 maxPrice) external onlyOwner {
        prices[token] = Price.Props({
            min: minPrice,
            max: maxPrice
        });
    }
}`;

    // Save the contract
    const contractPath = "contracts/oracle/MockOracleProvider.sol";
    console.log("  Saving contract to:", contractPath);
    fs.writeFileSync(contractPath, mockOracleProviderSource);
    console.log("  ✅ Contract source created");

    // Step 2: Compile the contract
    console.log("\n📍 Step 2: Compiling contract...");
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
        await execAsync('npx hardhat compile');
        console.log("  ✅ Contract compiled");
    } catch (error) {
        console.log("  ⚠️  Compilation warning/error (may be okay):", error.message);
    }

    // Step 3: Deploy the contract
    console.log("\n📍 Step 3: Deploying MockOracleProvider...");

    const MockOracleProvider = await ethers.getContractFactory("MockOracleProvider");
    const mockProvider = await MockOracleProvider.deploy();
    await mockProvider.deployed();

    console.log("  ✅ MockOracleProvider deployed to:", mockProvider.address);

    // Step 4: Set prices for USDT and sNGN
    console.log("\n📍 Step 4: Setting mock prices...");

    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    // USDT: $1 = 10^24
    const usdtPrice = ethers.BigNumber.from(10).pow(24);
    await mockProvider.setPrice(USDT, usdtPrice, usdtPrice);
    console.log("  ✅ USDT price set to $1.00");

    // sNGN: $1/1500 = 10^12 / 1500
    const sngnPrice = ethers.BigNumber.from(10).pow(12).div(1500);
    await mockProvider.setPrice(sNGN, sngnPrice, sngnPrice);
    console.log("  ✅ sNGN price set to $0.000666... (1/1500)");

    // Step 5: Enable the provider in DataStore
    console.log("\n📍 Step 5: Enabling provider in DataStore...");

    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Create the key for enabling oracle provider
    const oracleProviderEnabledKey = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["string", "address"],
            ["IS_ORACLE_PROVIDER_ENABLED", mockProvider.address]
        )
    );

    console.log("  Provider address:", mockProvider.address);
    console.log("  Key for enabling:", oracleProviderEnabledKey);

    try {
        const tx = await dataStore.setBool(oracleProviderEnabledKey, true);
        await tx.wait();
        console.log("  ✅ Provider enabled in DataStore");
    } catch (error) {
        console.log("  ❌ Failed to enable provider:", error.message);
        console.log("  You may need to grant CONTROLLER role to enable the provider");
    }

    // Save deployment info
    console.log("\n📍 Step 6: Saving deployment info...");
    const deploymentInfo = {
        mockOracleProvider: mockProvider.address,
        deployedAt: new Date().toISOString(),
        network: "arbitrumSepolia"
    };

    fs.writeFileSync("mock-oracle-provider.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("  ✅ Deployment info saved to mock-oracle-provider.json");

    console.log("\n✅ Mock Oracle Provider deployed and configured!");
    console.log("\nNext steps:");
    console.log("1. Use this provider address in your oracle params:", mockProvider.address);
    console.log("2. Pass it in the providers array when executing deposits");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });