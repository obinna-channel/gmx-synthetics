const { ethers } = require("hardhat");

async function main() {
    console.log("=== Oracle Internal Block Number Investigation ===\n");

    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    const ORACLE_STORE = "0xBc2408eF555c05A471A8242ef640061910EA4FD0";

    // Token addresses
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xd66e60AA5b6982649a116e6944Daec22b15468Ad";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    const oracleStore = await ethers.getContractAt("OracleStore", ORACLE_STORE);

    // Get current block info
    const currentBlock = await ethers.provider.getBlock("latest");
    console.log("📊 Current Chain State:");
    console.log("  Block Number:", currentBlock.number);
    console.log("  Block Timestamp:", currentBlock.timestamp);

    console.log("\n🔍 Attempting to find Oracle's internal block numbers:\n");

    // Method 1: Try to call validation functions to see what they return
    try {
        // Try to get the compact block numbers that Oracle uses
        // These are often stored as part of price reports
        console.log("1️⃣ Checking via OracleStore reports:");

        // Build a token price request to see what the Oracle expects
        const tokens = [USDT, sNGN];

        for (const token of tokens) {
            try {
                // Try to get any stored report data
                // Reports typically contain block numbers
                const reportKey = ethers.utils.keccak256(
                    ethers.utils.defaultAbiCoder.encode(
                        ["address"],
                        [token]
                    )
                );

                console.log(`\n  Token ${token === USDT ? 'USDT' : 'sNGN'}:`);

                // Try different storage slot patterns
                const slot0 = await ethers.provider.getStorageAt(ORACLE, reportKey);
                const slot1 = await ethers.provider.getStorageAt(ORACLE_STORE, reportKey);

                if (slot0 !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
                    console.log("    Oracle storage:", slot0);
                }
                if (slot1 !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
                    console.log("    OracleStore storage:", slot1);
                }
            } catch (e) {
                console.log(`    Error: ${e.message}`);
            }
        }
    } catch (e) {
        console.log("  Could not check reports:", e.message);
    }

    // Method 2: Try to simulate a validation call to extract block requirements
    console.log("\n2️⃣ Simulating validation to extract block requirements:");

    try {
        // Create a mock oracle params structure
        const mockOracleParams = {
            tokens: [USDT, sNGN],
            providers: [],
            data: []
        };

        // Try to encode some data with block numbers
        const currentBlockCompact = ethers.BigNumber.from(currentBlock.number);
        const currentTimestamp = ethers.BigNumber.from(currentBlock.timestamp);

        // Typical Oracle data encoding includes:
        // [minPrice, maxPrice, blockNumber, timestamp, blockHash]
        const usdtPrice = ethers.utils.parseUnits("1", 30); // $1 with 30 decimals
        const sngnPrice = ethers.utils.parseUnits("0.000667", 30); // ~$1/1500 with 30 decimals

        const usdtData = ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256", "uint256", "uint256"],
            [usdtPrice, usdtPrice, currentBlockCompact, currentTimestamp]
        );

        const sngnData = ethers.utils.defaultAbiCoder.encode(
            ["uint256", "uint256", "uint256", "uint256"],
            [sngnPrice, sngnPrice, currentBlockCompact, currentTimestamp]
        );

        mockOracleParams.data = [usdtData, sngnData];

        console.log("\n  Mock data created with:");
        console.log("    Current Block:", currentBlockCompact.toString());
        console.log("    Current Timestamp:", currentTimestamp.toString());

        // Try to call validatePrices (this might revert with useful info)
        try {
            // This will likely revert, but the revert message might tell us what block it expects
            await oracle.callStatic.validatePrices(
                mockOracleParams.tokens,
                mockOracleParams.providers,
                mockOracleParams.data
            );
            console.log("    Validation passed (unexpected!)");
        } catch (validationError) {
            console.log("\n  Validation failed with:", validationError.reason || validationError.message);

            // Try to decode if it's our block number error
            if (validationError.data && validationError.data.startsWith("0xd84b8ee8")) {
                const errorData = validationError.data;
                const decoded = ethers.utils.defaultAbiCoder.decode(
                    ["uint256", "uint256", "uint256"],
                    "0x" + errorData.slice(10)
                );

                console.log("\n  📍 ORACLE'S INTERNAL BLOCK NUMBER:", decoded[0].toString());
                console.log("     Required minimum block:", decoded[1].toString());
                console.log("     Difference:", decoded[2].toString());

                // Convert to human readable if they're timestamps
                const oracleBlock = decoded[0];
                if (oracleBlock.gt(1700000000) && oracleBlock.lt(2000000000)) {
                    console.log("\n     As timestamp:", new Date(oracleBlock.toNumber() * 1000).toISOString());
                }
            }
        }
    } catch (e) {
        console.log("  Could not simulate validation:", e.message);
    }

    // Method 3: Check for any getPrices function that might reveal state
    console.log("\n3️⃣ Checking for stored price data:");

    try {
        // Try to get prices with their metadata
        for (const token of [USDT, sNGN]) {
            const tokenName = token === USDT ? "USDT" : "sNGN";
            console.log(`\n  ${tokenName}:`);

            try {
                // Try different potential getter functions
                const primaryPrice = await oracle.primaryPrices(token);
                if (primaryPrice && primaryPrice.min) {
                    console.log("    Has primary price set");

                    // Check if there's associated block data
                    // Sometimes stored in a mapping with token + some offset
                    const blockSlot = ethers.utils.keccak256(
                        ethers.utils.defaultAbiCoder.encode(
                            ["address", "uint256"],
                            [token, 1] // Offset 1 might be block data
                        )
                    );

                    const blockData = await ethers.provider.getStorageAt(ORACLE, blockSlot);
                    if (blockData !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
                        console.log("    Associated data:", blockData);

                        // Try to parse as uint256
                        const parsed = ethers.BigNumber.from(blockData);
                        console.log("    Parsed as number:", parsed.toString());

                        if (parsed.gt(1700000000) && parsed.lt(2000000000)) {
                            console.log("    As timestamp:", new Date(parsed.toNumber() * 1000).toISOString());
                        }
                    }
                }
            } catch (e) {
                // Ignore individual token errors
            }
        }
    } catch (e) {
        console.log("  Could not check stored prices:", e.message);
    }

    // Method 4: Try to understand the Oracle's validate flow
    console.log("\n4️⃣ Attempting direct Oracle state inspection:");

    try {
        // Oracle contracts often have a concept of "report" or "price feed" data
        // Let's try to access any public state variables

        // Common state variable names in Oracle contracts
        const possibleGetters = [
            'latestBlockNumber',
            'lastBlockNumber',
            'currentBlockNumber',
            'blockNumber',
            'lastUpdateBlock',
            'latestRoundData',
            'getLatestPrice'
        ];

        for (const getter of possibleGetters) {
            try {
                const result = await oracle[getter]();
                console.log(`  ${getter}:`, result.toString());
            } catch (e) {
                // Function doesn't exist, continue
            }
        }

        // Try to get compact prices which might include block data
        try {
            const compactedPrices = await oracle.getCompactedPrices(
                [USDT, sNGN]
            );
            console.log("\n  Compacted prices found:");
            console.log("    Data:", compactedPrices);
        } catch (e) {
            // Function might not exist
        }

    } catch (e) {
        console.log("  Could not inspect Oracle state:", e.message);
    }

    console.log("\n✅ Investigation complete!");
    console.log("\n📌 To find the exact Oracle block number, we need to:");
    console.log("   1. Check the contract source code for how it stores block numbers");
    console.log("   2. Or trigger a validation error that reveals the expected block");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });