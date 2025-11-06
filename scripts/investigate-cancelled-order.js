const { ethers } = require("hardhat");

async function main() {
    const txHash = "0x581c818b74e3051db9af1948b5750d76011b77f06a338dbeb70ddfb6c55eadca";
    const orderKey = "0x21dbf55a6fbcb31254b7f058f1f3d194b7cb54ba24ac710f45266094f8e41681";

    console.log("=== Investigating Cancelled Order ===\n");

    // Get transaction details
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    const tx = await ethers.provider.getTransaction(txHash);

    // Get the Reader contract to fetch order details
    const readerAddress = "0xD7a5F18303139B77a634b8DbbA1A684C6a1C851D";
    const dataStoreAddress = "0xD4e917e95BFBcdb12a50E842C4fE80Ba81FD1e89";
    
    const Reader = await ethers.getContractAt("Reader", readerAddress);
    
    console.log("📋 Transaction Details:");
    console.log("Block:", receipt.blockNumber);
    console.log("Gas Used:", receipt.gasUsed.toString());
    
    // Try to get the order
    try {
        const order = await Reader.getOrder(dataStoreAddress, orderKey);
        console.log("\n📦 Order Details:");
        console.log("Account:", order.addresses.account);
        console.log("Market:", order.addresses.market);
        console.log("Size Delta USD:", ethers.utils.formatUnits(order.numbers.sizeDeltaUsd, 30));
        console.log("Order Type:", order.numbers.orderType);
    } catch (e) {
        console.log("\n❌ Order no longer exists (was cancelled/executed)");
    }

    // Decode the actual revert reason from internal calls
    console.log("\n🔍 Analyzing transaction trace...");
    
    // Parse all logs to find the cancellation reason
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const EVENT_LOG2_SIG = "0x468a25a7ba624ceea6e540ad6f49171b52495b648417ae91bca21676d8a24dc5";
    const ORDER_CANCELLED_HASH = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("OrderCancelled"));

    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === EVENT_EMITTER.toLowerCase()) {
            if (log.topics[0] === EVENT_LOG2_SIG && log.topics[1] === ORDER_CANCELLED_HASH) {
                console.log("\n❌ Order Cancellation Found");
                
                const data = log.data.slice(2);
                
                // Parse the cancellation data structure
                const keeper = '0x' + data.slice(24, 64);
                console.log("Keeper:", keeper);
                
                // Get offsets
                const reasonBytesOffset = parseInt(data.slice(64, 128), 16) * 2;
                const reasonStringOffset = parseInt(data.slice(128, 192), 16) * 2;
                
                console.log("\nReason bytes offset:", reasonBytesOffset);
                console.log("Reason string offset:", reasonStringOffset);
                
                // Extract reason string
                if (reasonStringOffset > 0 && reasonStringOffset < data.length) {
                    const reasonLength = parseInt(data.slice(reasonStringOffset, reasonStringOffset + 64), 16);
                    console.log("Reason string length:", reasonLength);
                    
                    if (reasonLength > 0 && reasonLength < 10000) {
                        const reasonHex = data.slice(reasonStringOffset + 64, reasonStringOffset + 64 + (reasonLength * 2));
                        
                        // Try to decode as UTF-8
                        try {
                            const reasonString = Buffer.from(reasonHex, 'hex').toString('utf8');
                            console.log("\n🔴 CANCELLATION REASON:");
                            console.log(reasonString);
                        } catch (e) {
                            console.log("Could not decode reason string");
                        }
                    }
                }
                
                // Extract reason bytes (the actual error)
                if (reasonBytesOffset > 0 && reasonBytesOffset < data.length) {
                    const reasonBytesLength = parseInt(data.slice(reasonBytesOffset, reasonBytesOffset + 64), 16);
                    
                    if (reasonBytesLength > 0 && reasonBytesLength < 1000) {
                        const reasonBytesHex = data.slice(reasonBytesOffset + 64, reasonBytesOffset + 64 + (reasonBytesLength * 2));
                        console.log("\n📊 Error Data (reasonBytes):");
                        console.log("0x" + reasonBytesHex);
                        
                        // Try to decode error selector
                        if (reasonBytesHex.length >= 8) {
                            const errorSelector = '0x' + reasonBytesHex.slice(0, 8);
                            console.log("\nError Selector:", errorSelector);
                            
                            // Try to decode the full error if it has parameters
                            if (reasonBytesHex.length > 8) {
                                const errorData = '0x' + reasonBytesHex;
                                
                                // Try common error signatures
                                const errorInterfaces = [
                                    "error InvalidDecreaseOrderSize(uint256 sizeDeltaUsd, uint256 positionSizeInUsd)",
                                    "error EmptyDecrease()",
                                    "error InsufficientReservedUsd(uint256 poolUsd, uint256 reservedUsd)",
                                    "error InsufficientLiquidity(uint256 requiredAmount, uint256 availableAmount)",
                                ];
                                
                                for (const errorSig of errorInterfaces) {
                                    try {
                                        const iface = new ethers.utils.Interface([errorSig]);
                                        const decoded = iface.parseError(errorData);
                                        console.log("\n⚠️  Decoded Error:", decoded.name);
                                        console.log("Parameters:", decoded.args);
                                        break;
                                    } catch (e) {
                                        // Try next error signature
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

main().catch(console.error);
