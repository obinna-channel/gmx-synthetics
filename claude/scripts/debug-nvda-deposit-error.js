const { ethers } = require("hardhat");

async function main() {
    console.log("=== Debugging NVDA Deposit Error ===\n");

    const MOCK_PROVIDER = "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5";
    const mNVDA = "0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325";
    const mUSD = "0x85bf04B07A6df0172372b959C1C73F3e90F73faf";
    const ORACLE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";

    // Decode the error
    console.log("📍 Error Data Analysis:");
    const errorData = "0x68b49e6c0000000000000000000000005d85d4acd35ffd0dad76c5eb0da3d7e53e20ccc50000000000000000000000000000000000000000000000000000000000000000";
    console.log("Error selector: 0x68b49e6c");
    console.log("Full error data:", errorData);

    // Try to decode the parameters
    const paramData = errorData.slice(10); // Remove '0x68b49e6c'
    try {
        const decoded = ethers.utils.defaultAbiCoder.decode(
            ['address', 'uint256'],
            '0x' + paramData
        );
        console.log("Decoded params:");
        console.log("  Address:", decoded[0]);
        console.log("  Value:", decoded[1].toString());
    } catch (e) {
        console.log("Could not decode:", e.message);
    }

    // Check MockOracleProvider for prices
    console.log("\n📍 Checking MockOracleProvider Prices:");

    const mockProviderAbi = [
        {
            "inputs": [{"name": "token", "type": "address"}],
            "name": "getPrice",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [{"name": "token", "type": "address"}],
            "name": "prices",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    const mockProvider = await ethers.getContractAt(mockProviderAbi, MOCK_PROVIDER);

    try {
        const nvdaPrice = await mockProvider.prices(mNVDA);
        console.log("  mNVDA price:", nvdaPrice.toString());
        console.log("  mNVDA price (formatted):", ethers.utils.formatUnits(nvdaPrice, 30));
    } catch (e) {
        console.log("  Error getting mNVDA price:", e.message);
    }

    try {
        const musdPrice = await mockProvider.prices(mUSD);
        console.log("  mUSD price:", musdPrice.toString());
        console.log("  mUSD price (formatted):", ethers.utils.formatUnits(musdPrice, 30));
    } catch (e) {
        console.log("  Error getting mUSD price:", e.message);
    }

    // Check if Oracle can get prices
    console.log("\n📍 Checking Oracle.getPrimaryPrice:");

    const oracleAbi = [
        {
            "inputs": [{"name": "token", "type": "address"}],
            "name": "getPrimaryPrice",
            "outputs": [
                {
                    "components": [
                        {"name": "min", "type": "uint256"},
                        {"name": "max", "type": "uint256"}
                    ],
                    "name": "",
                    "type": "tuple"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    const oracle = await ethers.getContractAt(oracleAbi, ORACLE);

    try {
        const nvdaPrimaryPrice = await oracle.getPrimaryPrice(mNVDA);
        console.log("  mNVDA primary price:");
        console.log("    min:", nvdaPrimaryPrice.min.toString());
        console.log("    max:", nvdaPrimaryPrice.max.toString());
    } catch (e) {
        console.log("  ❌ Error getting mNVDA primary price:", e.message);
    }

    try {
        const musdPrimaryPrice = await oracle.getPrimaryPrice(mUSD);
        console.log("  mUSD primary price:");
        console.log("    min:", musdPrimaryPrice.min.toString());
        console.log("    max:", musdPrimaryPrice.max.toString());
    } catch (e) {
        console.log("  ❌ Error getting mUSD primary price:", e.message);
    }

    // Search for the error signature in common GMX errors
    console.log("\n📍 Error Signature Analysis:");
    console.log("  0x68b49e6c could be:");
    console.log("  - OracleError");
    console.log("  - EmptyProvider");
    console.log("  - InvalidPrice");
    console.log("  Let's check the error registry...");

    // Try to call validateDeposit or similar to get better error
    console.log("\n📍 Attempting to get detailed error from DepositHandler...");
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const depositKey = "0x6f90f44a582c9561b8427d64d126213433ec7594344b83018378899c4706947b";

    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);

    const oracleParams = {
        tokens: [mNVDA, mUSD],
        providers: [MOCK_PROVIDER, MOCK_PROVIDER],
        data: ["0x", "0x"]
    };

    try {
        await depositHandler.callStatic.executeDeposit(depositKey, oracleParams);
        console.log("  ✅ Static call succeeded (this shouldn't happen)");
    } catch (error) {
        console.log("  ❌ Static call failed with:");
        console.log("     Message:", error.message);
        if (error.error && error.error.data) {
            console.log("     Error data:", error.error.data);
        }
        if (error.errorName) {
            console.log("     Error name:", error.errorName);
        }
        if (error.errorArgs) {
            console.log("     Error args:", error.errorArgs);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
