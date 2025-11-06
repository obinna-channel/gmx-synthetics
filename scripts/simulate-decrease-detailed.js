const { ethers } = require("hardhat");

async function main() {
    const MARKET = ethers.utils.getAddress("0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69");
    const mUSD = ethers.utils.getAddress("0x85bf04B07A6df0172372b959C1C73F3e90F73faf");
    const DATA_STORE = ethers.utils.getAddress("0xD70154A2e4BEF0485Bb6d90265a4F878A4556111");
    const ORDER_HANDLER = ethers.utils.getAddress("0x83f2D66af7f794893C31c0B32BD2D4cE826871d7");
    const USER = ethers.utils.getAddress("0x49e082bdda2865a36ed2294819d3c214709cdbaa");
    const ORDER_KEY = "0x754740488afae8525c1958347881af7c2957e0c7b20683889290f6fa86f08ad9";

    console.log("=== Simulating Decrease Order Execution ===\n");

    const [signer] = await ethers.getSigners();
    console.log("Using signer:", signer.address, "\n");

    const orderHandler = await ethers.getContractAt("OrderHandler", ORDER_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);

    // Get the order details
    const ORDER_PROPS_KEY = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_PROPS"])
    );

    try {
        // Try to call simulateExecuteOrder
        const currentTime = Math.floor(Date.now() / 1000);
        const mockPriceParams = {
            primaryTokens: [
                ethers.utils.getAddress("0xed6890bE2409F0db06a00C809a298E2E06553BE1"), // mUSDTARS
                ethers.utils.getAddress("0x85bf04B07A6df0172372b959C1C73F3e90F73faf")  // mUSD
            ],
            primaryPrices: [
                {
                    min: ethers.utils.parseUnits("1572.5", 6),  // $1572.5 with 6dp precision
                    max: ethers.utils.parseUnits("1572.5", 6)
                },
                {
                    min: ethers.utils.parseUnits("1", 6),  // $1 with 6dp precision
                    max: ethers.utils.parseUnits("1", 6)
                }
            ],
            minTimestamp: currentTime - 60,
            maxTimestamp: currentTime
        };

        console.log("🔍 Attempting to simulate order execution...\n");

        const tx = await orderHandler.callStatic.simulateExecuteOrder(
            ORDER_KEY,
            mockPriceParams
        );

        console.log("✅ Simulation succeeded!");
        console.log("Result:", tx);

    } catch (error) {
        console.log("❌ Simulation failed (this is expected):\n");

        if (error.message) {
            console.log("Error message:", error.message);
        }

        // Try to extract the revert reason
        if (error.data) {
            console.log("\nError data:", error.data);

            try {
                // Try to decode custom error
                const errorInterface = new ethers.utils.Interface([
                    "error InsufficientFundsToPayForCosts(uint256 remainingCostUsd, string step)",
                    "error InsufficientPoolAmount(uint256 poolAmount, uint256 amount)",
                    "error PoolAmountLessThanOpenInterestInTokens(uint256 poolAmount, uint256 openInterestInTokens)",
                    "error EmptyPosition()",
                    "error InvalidDecreaseOrderSize(uint256 sizeDeltaUsd, uint256 positionSizeInUsd)",
                    "error UnableToWithdrawCollateral(int256 estimatedRemainingCollateralUsd)"
                ]);

                for (const errorName of [
                    "InsufficientFundsToPayForCosts",
                    "InsufficientPoolAmount",
                    "PoolAmountLessThanOpenInterestInTokens",
                    "EmptyPosition",
                    "InvalidDecreaseOrderSize",
                    "UnableToWithdrawCollateral"
                ]) {
                    try {
                        const decoded = errorInterface.decodeErrorResult(errorName, error.data);
                        console.log(`\n✅ Decoded as ${errorName}:`);
                        console.log("  Parameters:", decoded);
                        return;
                    } catch (e) {
                        // Not this error, continue
                    }
                }

                console.log("\n⚠️  Could not decode error as known custom error");
            } catch (e) {
                console.log("\n⚠️  Error decoding:", e.message);
            }
        }

        if (error.error && error.error.data) {
            console.log("\nError.error.data:", error.error.data);
        }

        console.log("\n💡 Full error object:");
        console.log(JSON.stringify(error, null, 2));
    }
}

main().catch(console.error);
