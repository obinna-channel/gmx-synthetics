const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x581c818b74e3051db9af1948b5750d76011b77f06a338dbeb70ddfb6c55eadca";
    
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
    const ORDER_CANCELLED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCancelled"));

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
            if (log.topics[0] === EVENT_LOG2_SIG && log.topics[1] === ORDER_CANCELLED_HASH) {
                console.log("Raw log data:");
                console.log(log.data);
                
                // Try to decode using the OrderCancelled event ABI
                const eventAbi = [
                    "event OrderCancelled(bytes32 indexed key, address orderKeeper, bytes reasonBytes, string reason)"
                ];
                
                const iface = new ethers.utils.Interface(eventAbi);
                
                // The actual event is emitted via EventLog2, so we need to decode just the data part
                // The event structure has the key in topics[2]
                
                console.log("\nOrder Key (topics[2]):", log.topics[2]);
                
                // Decode the data payload
                // It contains: orderKeeper, reasonBytes, reason
                try {
                    // Manual decoding since it's wrapped in EventLog2
                    const abiCoder = ethers.utils.defaultAbiCoder;
                    const decoded = abiCoder.decode(
                        ['address', 'bytes', 'string'],
                        log.data
                    );
                    
                    console.log("\nDecoded Event Data:");
                    console.log("Order Keeper:", decoded[0]);
                    console.log("Reason Bytes:", decoded[1]);
                    console.log("Reason String:", decoded[2]);
                    
                    // If reasonBytes has data, try to decode it as an error
                    if (decoded[1] && decoded[1] !== '0x' && decoded[1].length > 10) {
                        const errorData = decoded[1];
                        console.log("\n🔍 Decoding Error from reasonBytes:", errorData);
                        
                        const errorSelector = errorData.slice(0, 10);
                        console.log("Error Selector:", errorSelector);
                        
                        // Try to decode with known error signatures
                        const knownErrors = [
                            "error InvalidDecreaseOrderSize(uint256 sizeDeltaUsd, uint256 positionSizeInUsd)",
                            "error EmptyDecrease()",
                            "error EmptyPosition()",
                            "error InsufficientReservedUsd(uint256 poolUsd, uint256 reservedUsd)",
                            "error InsufficientLiquidity(uint256 requiredAmount, uint256 availableAmount)",
                            "error InvalidPositionMarket(address market)",
                            "error InvalidCollateralTokenForMarket(address market, address token)",
                        ];
                        
                        for (const errorSig of knownErrors) {
                            try {
                                const errorIface = new ethers.utils.Interface([errorSig]);
                                const decodedError = errorIface.parseError(errorData);
                                console.log("\n✅ IDENTIFIED ERROR:", decodedError.name);
                                if (decodedError.args && decodedError.args.length > 0) {
                                    console.log("Error Parameters:");
                                    for (let i = 0; i < decodedError.args.length; i++) {
                                        console.log(`  [${i}]:`, decodedError.args[i].toString());
                                    }
                                }
                                return; // Exit after finding the error
                            } catch (e) {
                                // Continue to next error signature
                            }
                        }
                        
                        console.log("\n❌ Could not decode error (unknown selector)");
                    }
                    
                } catch (e) {
                    console.log("Error decoding:", e.message);
                    console.log(e);
                }
            }
        }
    }
}

main().catch(console.error);
