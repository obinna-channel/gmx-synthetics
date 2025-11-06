const { ethers } = require("hardhat");

async function main() {
    const errorData = "0x59485ed9754740488afae8525c1958347881af7c2957e0c7b20683889290f6fa86f08ad9";
    const errorSelector = errorData.slice(0, 10);

    console.log("Error Selector:", errorSelector);
    console.log();

    // Common GMX errors
    const errors = [
        "error EmptyOrder()",
        "error OrderNotFound(bytes32 key)",
        "error InsufficientPoolAmount(uint256 poolAmount, uint256 amount)",
        "error PoolAmountLessThanOpenInterestInTokens(uint256 poolAmount, uint256 openInterestInTokens)",
        "error EmptyPosition()",
        "error InvalidDecreaseOrderSize(uint256 sizeDeltaUsd, uint256 positionSizeInUsd)",
        "error UnableToWithdrawCollateral(int256 estimatedRemainingCollateralUsd)",
        "error InsufficientFundsToPayForCosts(uint256 remainingCostUsd, string step)",
        "error InsufficientOutputAmount(uint256 outputAmount, uint256 minOutputAmount)"
    ];

    for (const errorSig of errors) {
        try {
            const iface = new ethers.utils.Interface([errorSig]);
            const errorName = errorSig.match(/error (\w+)/)[1];
            const selector = ethers.utils.id(errorSig.replace("error ", "").replace(/\s/g, "")).slice(0, 10);

            if (selector.toLowerCase() === errorSelector.toLowerCase()) {
                console.log(`✅ FOUND: ${errorSig}`);
                console.log(`   Selector: ${selector}`);

                try {
                    const decoded = iface.decodeErrorResult(errorName, errorData);
                    console.log(`   Decoded params:`, decoded);
                } catch (e) {
                    console.log(`   (Could not decode params: ${e.message})`);
                }

                return;
            }
        } catch (e) {
            // Skip if interface creation fails
        }
    }

    console.log("❌ Error not found in common errors list");
    console.log("   Selector hash:", errorSelector);
}

main().catch(console.error);
