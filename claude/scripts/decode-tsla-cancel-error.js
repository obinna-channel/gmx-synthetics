const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const txHash = "0x79281d7aa502b83e4bdf63447e954a20328db060742833e4a91365a4c0d91ee5";

    console.log("=== Fetching Transaction Receipt ===");
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
    console.log("Block:", receipt.blockNumber);

    // Load EventEmitter ABI
    const eventEmitterPath = "./deployments/marks/arbitrumSepolia/EventEmitter.json";
    const eventEmitterData = JSON.parse(fs.readFileSync(eventEmitterPath));
    const eventEmitter = new ethers.Contract(eventEmitterData.address, eventEmitterData.abi, ethers.provider);

    console.log("\n=== Decoding OrderCancelled Event ===");

    // Find the OrderCancelled log (Log 2 based on previous output)
    for (const log of receipt.logs) {
        if (log.data.includes("4f7264657243616e63656c6c6564")) {
            console.log("Found OrderCancelled event!");
            console.log("Full data length:", log.data.length);

            // The GMX event system uses a complex encoding
            // Let's try to decode using the EventEmitter interface
            try {
                const parsed = eventEmitter.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                console.log("\nEvent name:", parsed.name);
                console.log("Args:", JSON.stringify(parsed.args, (key, value) =>
                    typeof value === 'bigint' ? value.toString() : value
                , 2));
            } catch (e) {
                console.log("Parse error:", e.message);
            }

            // Manual decode of the event data
            // EventLog2 structure: (address msgSender, string actionType, string eventName, bytes32 eventNameHash, bytes eventData)
            const abiCoder = new ethers.utils.AbiCoder();

            try {
                // First decode the outer structure
                const decoded = abiCoder.decode(
                    ["address", "string", "string", "bytes"],
                    "0x" + log.data.slice(2)
                );

                console.log("\n=== Decoded Event Structure ===");
                console.log("Msg Sender:", decoded[0]);
                console.log("Action Type:", decoded[1]);
                console.log("Event Name:", decoded[2]);
                console.log("Event Data Length:", decoded[3].length);

                // The eventData contains the actual cancellation details
                // Let's try to decode the inner structure
                const eventData = decoded[3];
                console.log("\nEvent Data (hex):", eventData.substring(0, 500) + "...");

            } catch (e) {
                console.log("Decode error:", e.message);
            }

            // Let's look for specific error patterns in the raw data
            console.log("\n=== Looking for Error Patterns ===");

            // Convert hex to check for readable strings
            const hexData = log.data.slice(2);

            // Look for common error strings
            const errorPatterns = [
                "InsufficientPoolAmount",
                "MaxPoolAmountExceeded",
                "InsufficientOutputAmount",
                "OrderNotFulfillableAtAcceptablePrice",
                "DisabledFeature",
                "InvalidMarketTokenBalance",
                "UnexpectedPoolValue"
            ];

            for (const pattern of errorPatterns) {
                const hexPattern = Buffer.from(pattern).toString('hex');
                if (hexData.includes(hexPattern)) {
                    console.log(`Found error pattern: ${pattern}`);
                }
            }

            // Try to decode as the cancellation event format
            // The reason is typically at a specific offset
            console.log("\n=== Attempting to decode reason bytes ===");

            // Find the reasonBytes section - it usually contains the actual error
            // Look for common error selectors
            const selectors = {
                "0x35278d12": "Unauthorized",
                "0x1e107c69": "EmptyPosition",
                "0x6f85ac00": "InsufficientPoolAmount",
                "0x8d7f8ec1": "MaxPoolAmountExceeded",
                "0x86c0febe": "InsufficientOutputAmount",
                "0xb353b6b6": "InvalidMarketTokenBalance"
            };

            for (const [selector, name] of Object.entries(selectors)) {
                if (hexData.includes(selector.slice(2))) {
                    console.log(`Found error selector: ${name} (${selector})`);
                }
            }

            // Let's also look at the raw bytes for clues
            console.log("\n=== Raw Data Analysis ===");
            // Split into 32-byte chunks for easier reading
            for (let i = 0; i < Math.min(hexData.length, 1600); i += 64) {
                const chunk = hexData.slice(i, i + 64);
                const offset = i / 2;

                // Try to decode as string if it looks like text
                let decoded = "";
                try {
                    const bytes = Buffer.from(chunk, 'hex');
                    const ascii = bytes.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
                    if (ascii.match(/[a-zA-Z]{3,}/)) {
                        decoded = ` -> "${ascii}"`;
                    }
                } catch (e) {}

                console.log(`  ${offset.toString().padStart(4)}: 0x${chunk}${decoded}`);
            }
        }
    }

    // Also check for UnexpectedPoolValue error which is common
    console.log("\n=== Checking Market Token Balance Issues ===");

    const dataStorePath = "./deployments/marks/arbitrumSepolia/DataStore.json";
    const dataStoreData = JSON.parse(fs.readFileSync(dataStorePath));
    const dataStore = new ethers.Contract(dataStoreData.address, dataStoreData.abi, ethers.provider);

    const marketAddress = "0x8ae559448a1482faffC925eF6a233276588348Df";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";

    // Check pool amount
    const abiCoder = new ethers.utils.AbiCoder();
    const poolAmountKey = ethers.utils.keccak256(
        abiCoder.encode(
            ["bytes32", "address", "address"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("POOL_AMOUNT")), marketAddress, mUSD]
        )
    );
    const poolAmount = await dataStore.getUint(poolAmountKey);
    console.log("Pool Amount (mUSD):", ethers.utils.formatUnits(poolAmount, 6));

    // Check the market token contract balance
    const mUSDContract = new ethers.Contract(mUSD, ["function balanceOf(address) view returns (uint256)"], ethers.provider);
    const marketTokenBalance = await mUSDContract.balanceOf(marketAddress);
    console.log("Market Token mUSD Balance:", ethers.utils.formatUnits(marketTokenBalance, 6));

    // Check collateral amounts
    const longCollateralKey = ethers.utils.keccak256(
        abiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("COLLATERAL_SUM")), marketAddress, mUSD, true]
        )
    );
    const shortCollateralKey = ethers.utils.keccak256(
        abiCoder.encode(
            ["bytes32", "address", "address", "bool"],
            [ethers.utils.keccak256(ethers.utils.toUtf8Bytes("COLLATERAL_SUM")), marketAddress, mUSD, false]
        )
    );
    const longCollateral = await dataStore.getUint(longCollateralKey);
    const shortCollateral = await dataStore.getUint(shortCollateralKey);
    console.log("Long Collateral:", ethers.utils.formatUnits(longCollateral, 6));
    console.log("Short Collateral:", ethers.utils.formatUnits(shortCollateral, 6));

    // Calculate expected market token balance
    const expectedBalance = poolAmount.add(longCollateral).add(shortCollateral);
    console.log("\nExpected Market Balance:", ethers.utils.formatUnits(expectedBalance, 6));
    console.log("Actual Market Balance:", ethers.utils.formatUnits(marketTokenBalance, 6));
    console.log("Difference:", ethers.utils.formatUnits(marketTokenBalance.sub(expectedBalance), 6));
}

main().catch(console.error);
