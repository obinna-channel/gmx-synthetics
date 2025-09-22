const { ethers } = require("hardhat");

async function main() {
    console.log("=== Debugging Failed Transaction ===\n");

    // The failed transaction hash
    const txHash = "0x42f261c48ce081c68302f9262d3e074e75baf53a9d3bc59157e1df73f9806600";

    const provider = ethers.provider;

    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    console.log("Transaction Hash:", txHash);
    console.log("Status:", receipt.status === 0 ? "❌ FAILED" : "✅ SUCCESS");
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Gas Limit:", tx.gasLimit.toString());

    // Try to simulate the transaction to get the revert reason
    console.log("\nAttempting to trace the error...");

    try {
        // Try calling the function statically to get the revert reason
        const depositHandler = await ethers.getContractAt("DepositHandler", tx.to);

        // Decode the transaction data
        const iface = depositHandler.interface;
        const decoded = iface.parseTransaction({ data: tx.data });

        console.log("\nFunction called:", decoded.name);
        console.log("Parameters:");
        console.log("  Deposit Key:", decoded.args[0]);
        console.log("  Oracle Params:");
        console.log("    Tokens:", decoded.args[1].tokens);
        console.log("    Providers:", decoded.args[1].providers);
        console.log("    Data length:", decoded.args[1].data.length);

        // Try to call the function statically to see the error
        console.log("\nTrying static call to reproduce error...");
        try {
            await depositHandler.callStatic.executeDeposit(
                decoded.args[0],
                decoded.args[1],
                { from: tx.from }
            );
        } catch (error) {
            console.log("\n🔍 Error reproduced:");
            console.log("  Message:", error.message);

            // Try to decode the error
            if (error.data) {
                console.log("  Error data:", error.data);

                // Common error selectors in GMX
                const errorSelectors = {
                    "0x2e30c16f": "OracleTimestampsAreLargerThanRequestExpirationTime",
                    "0x8ac2c168": "OracleTimestampsAreSmallerThanRequired",
                    "0x7c1f8113": "EmptyDeposit",
                    "0x6a2af665": "UnauthorizedKeeper",
                    "0x0a81dcb3": "InvalidPrices",
                    "0xb97e9d4a": "EmptyPrimaryPrice",
                    "0x5a8ae4f8": "InvalidSignature",
                    "0xe1efb469": "MaxSignerIndexExceeded",
                    "0x089fe6aa": "Slippage"
                };

                const selector = error.data.substring(0, 10);
                if (errorSelectors[selector]) {
                    console.log("  ❗ Error type:", errorSelectors[selector]);
                }
            }

            // Try to get the reason string
            if (error.reason) {
                console.log("  Reason:", error.reason);
            }
        }

    } catch (error) {
        console.log("Could not trace error:", error.message);
    }

    // Check what prices were set at the time
    console.log("\n\n=== Checking Current Oracle State ===");
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";

    const oracle = await ethers.getContractAt("Oracle", ORACLE);

    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("\nUSDT Price:");
        console.log("  Min:", usdtPrice.min.toString());
        console.log("  Max:", usdtPrice.max.toString());
        if (usdtPrice.min.eq(0)) {
            console.log("  ⚠️  USDT price not set");
        }
    } catch (e) {
        console.log("Could not read USDT price");
    }

    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("\nsNGN Price:");
        console.log("  Min:", ethers.utils.formatUnits(ngnPrice.min, 30));
        console.log("  Max:", ethers.utils.formatUnits(ngnPrice.max, 30));
        if (ngnPrice.min.gt(0)) {
            console.log("  ✅ sNGN price is set");
        }
    } catch (e) {
        console.log("Could not read sNGN price");
    }
}

main().catch(console.error);