const { ethers } = require("hardhat");

async function main() {
    // The error data I found in the raw log
    const errorData = "0xe73a05d500000000000000000000000000000000000000000000000000000000001153390000000000000000000000000000000000000000000000000000000000124f80";
    
    console.log("Error Data:", errorData);
    console.log("Error Selector:", errorData.slice(0, 10));
    
    // Try all known decrease order errors
    const knownErrors = [
        "error InvalidDecreaseOrderSize(uint256 sizeDeltaUsd, uint256 positionSizeInUsd)",
        "error EmptyDecrease()",
        "error EmptyPosition()",
        "error InsufficientReservedUsd(uint256 poolUsd, uint256 reservedUsd)",
        "error InsufficientLiquidity(uint256 requiredAmount, uint256 availableAmount)",
        "error InvalidPositionMarket(address market)",
        "error InvalidCollateralTokenForMarket(address market, address token)",
        "error InsufficientCollateral(uint256 available, uint256 required)",
        "error InsufficientFundsForCollateral(address market, address collateralToken, uint256 amount)",
        "error InvalidPositionSizeValues(uint256 size, uint256 collateral)",
    ];
    
    for (const errorSig of knownErrors) {
        try {
            const iface = new ethers.utils.Interface([errorSig]);
            const decoded = iface.parseError(errorData);
            console.log("\n✅ FOUND ERROR:", decoded.name);
            if (decoded.args && decoded.args.length > 0) {
                console.log("\nError Parameters:");
                for (let i = 0; i < decoded.args.length; i++) {
                    const value = decoded.args[i];
                    const valueStr = value.toString();
                    const valueFormatted = ethers.utils.formatUnits(value, 30);
                    console.log("  " + i + ": " + valueStr + " (" + valueFormatted + " in 30 decimals)");
                }
            }
            return;
        } catch (e) {
            //continue
        }
    }
    
    console.log("\n❌ Unknown error selector");
    
    // Calculate what this selector is
    const testErrors = [
        "InvalidDecreaseOrderSize(uint256,uint256)",
        "InvalidPositionSizeValues(uint256,uint256)",
        "InsufficientReservedUsd(uint256,uint256)",
    ];
    
    console.log("\nCalculating selectors:");
    for (const sig of testErrors) {
        const selector = ethers.utils.id(sig).slice(0, 10);
        console.log("  " + sig + ": " + selector);
    }
}

main().catch(console.error);
