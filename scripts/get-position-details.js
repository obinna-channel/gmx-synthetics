const { ethers } = require("hardhat");

async function main() {
    const TARGET_USER = "0xfE6a58323acFd101981CB00530Fb8089B137115F";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const POSITION_OPEN_BLOCK = 206770529;
    const LIQUIDATION_BLOCK = 207102257;

    console.log("=== Getting Position Details ===\n");
    console.log("User:", TARGET_USER);
    console.log();

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    // Query EventLog1 for PositionIncrease and PositionDecrease
    const filter = eventEmitter.filters.EventLog1();

    console.log("Fetching PositionIncrease event (when opened)...\n");
    const openEvents = await eventEmitter.queryFilter(filter, POSITION_OPEN_BLOCK, POSITION_OPEN_BLOCK + 50);

    console.log("Fetching PositionDecrease event (when liquidated)...\n");
    const liquidateEvents = await eventEmitter.queryFilter(filter, LIQUIDATION_BLOCK, LIQUIDATION_BLOCK + 10);

    console.log("=".repeat(80));
    console.log("\n📈 POSITION OPENED:\n");

    for (const event of openEvents) {
        if (event.args.eventName !== "PositionIncrease") continue;

        const eventData = event.args.eventData;

        // Check if this is our user
        let isUser = false;
        if (eventData.addressItems && eventData.addressItems.items) {
            for (const addr of eventData.addressItems.items) {
                if (addr.key === "account" && addr.value.toLowerCase() === TARGET_USER.toLowerCase()) {
                    isUser = true;
                    break;
                }
            }
        }

        if (!isUser) continue;

        console.log("Block:", event.blockNumber);
        console.log("Tx:", event.transactionHash);
        console.log();

        // Parse all the details
        if (eventData.addressItems && eventData.addressItems.items) {
            console.log("📍 Addresses:");
            for (const addr of eventData.addressItems.items) {
                console.log("  ", addr.key + ":", addr.value);
            }
            console.log();
        }

        if (eventData.uintItems && eventData.uintItems.items) {
            console.log("🔢 Numbers:");
            for (const uint of eventData.uintItems.items) {
                const key = uint.key;
                const value = uint.value;

                // Format based on known fields
                if (key.includes("Usd") || key.includes("USD")) {
                    console.log("  ", key + ":", ethers.utils.formatUnits(value, 30), "USD");
                } else if (key.includes("Amount")) {
                    console.log("  ", key + ":", ethers.utils.formatUnits(value, 6));
                } else if (key.includes("Price")) {
                    console.log("  ", key + ":", ethers.utils.formatUnits(value, 30));
                } else {
                    console.log("  ", key + ":", value.toString());
                }
            }
            console.log();
        }

        if (eventData.intItems && eventData.intItems.items) {
            console.log("➕➖ Signed Numbers:");
            for (const int of eventData.intItems.items) {
                const key = int.key;
                const value = int.value;

                if (key.includes("Usd") || key.includes("USD")) {
                    console.log("  ", key + ":", ethers.utils.formatUnits(value.abs(), 30), value.isNegative() ? "(negative)" : "");
                } else {
                    console.log("  ", key + ":", value.toString());
                }
            }
            console.log();
        }

        if (eventData.boolItems && eventData.boolItems.items) {
            console.log("✓ Flags:");
            for (const bool of eventData.boolItems.items) {
                console.log("  ", bool.key + ":", bool.value);
            }
            console.log();
        }
    }

    console.log("=".repeat(80));
    console.log("\n📉 POSITION LIQUIDATED:\n");

    for (const event of liquidateEvents) {
        if (event.args.eventName !== "PositionDecrease") continue;

        const eventData = event.args.eventData;

        // Check if this is our user
        let isUser = false;
        if (eventData.addressItems && eventData.addressItems.items) {
            for (const addr of eventData.addressItems.items) {
                if (addr.key === "account" && addr.value.toLowerCase() === TARGET_USER.toLowerCase()) {
                    isUser = true;
                    break;
                }
            }
        }

        if (!isUser) continue;

        console.log("Block:", event.blockNumber);
        console.log("Tx:", event.transactionHash);
        console.log();

        if (eventData.addressItems && eventData.addressItems.items) {
            console.log("📍 Addresses:");
            for (const addr of eventData.addressItems.items) {
                console.log("  ", addr.key + ":", addr.value);
            }
            console.log();
        }

        if (eventData.uintItems && eventData.uintItems.items) {
            console.log("🔢 Numbers:");
            for (const uint of eventData.uintItems.items) {
                const key = uint.key;
                const value = uint.value;

                if (key.includes("Usd") || key.includes("USD")) {
                    console.log("  ", key + ":", ethers.utils.formatUnits(value, 30), "USD");
                } else if (key.includes("Amount")) {
                    console.log("  ", key + ":", ethers.utils.formatUnits(value, 6));
                } else if (key.includes("Price")) {
                    console.log("  ", key + ":", ethers.utils.formatUnits(value, 30));
                } else {
                    console.log("  ", key + ":", value.toString());
                }
            }
            console.log();
        }

        if (eventData.intItems && eventData.intItems.items) {
            console.log("➕➖ Signed Numbers:");
            for (const int of eventData.intItems.items) {
                const key = int.key;
                const value = int.value;

                if (key.includes("Usd") || key.includes("USD")) {
                    const absValue = value.lt(0) ? value.mul(-1) : value;
                    console.log("  ", key + ":", ethers.utils.formatUnits(absValue, 30), value.lt(0) ? "(LOSS)" : "USD");
                } else {
                    console.log("  ", key + ":", value.toString());
                }
            }
            console.log();
        }

        if (eventData.boolItems && eventData.boolItems.items) {
            console.log("✓ Flags:");
            for (const bool of eventData.boolItems.items) {
                console.log("  ", bool.key + ":", bool.value);
            }
            console.log();
        }
    }
}

main().catch(console.error);
