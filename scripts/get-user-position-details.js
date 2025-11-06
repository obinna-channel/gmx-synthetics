const { ethers } = require("hardhat");

async function main() {
    const TARGET_USER = process.env.USER_ADDRESS || "0x0D7F7fe4b4B01293482a535737d1909E166d30Da";
    const EVENT_EMITTER = "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C";
    const LIQUIDATION_BLOCK = 207089724;

    console.log("=== Getting Position Details for User ===\n");
    console.log("User:", TARGET_USER);
    console.log("Liquidation Block:", LIQUIDATION_BLOCK);
    console.log();

    const eventEmitter = await ethers.getContractAt("EventEmitter", EVENT_EMITTER);

    // Search backwards from liquidation to find position opening
    const searchFromBlock = Math.max(0, LIQUIDATION_BLOCK - 2000000);

    console.log("Searching for PositionIncrease event (when opened)...");
    console.log("Range:", searchFromBlock, "to", LIQUIDATION_BLOCK);
    console.log();

    const filter1 = eventEmitter.filters.EventLog1();
    const allEvents = await eventEmitter.queryFilter(filter1, searchFromBlock, LIQUIDATION_BLOCK + 10);

    let positionOpenEvent = null;
    let positionCloseEvent = null;

    for (const event of allEvents) {
        const eventData = event.args.eventData;

        if (!eventData.addressItems || !eventData.addressItems.items) continue;

        let isUser = false;
        for (const addr of eventData.addressItems.items) {
            if (addr.key === "account" && addr.value.toLowerCase() === TARGET_USER.toLowerCase()) {
                isUser = true;
                break;
            }
        }

        if (!isUser) continue;

        if (event.args.eventName === "PositionIncrease" && !positionOpenEvent) {
            positionOpenEvent = event;
        }
        if (event.args.eventName === "PositionDecrease" && event.blockNumber === LIQUIDATION_BLOCK) {
            positionCloseEvent = event;
        }
    }

    if (!positionOpenEvent) {
        console.log("❌ Could not find PositionIncrease event for this user");
        return;
    }

    if (!positionCloseEvent) {
        console.log("❌ Could not find PositionDecrease event for this user");
        return;
    }

    console.log("=".repeat(80));
    console.log("\n📈 POSITION OPENED:\n");

    const openData = positionOpenEvent.args.eventData;
    console.log("Block:", positionOpenEvent.blockNumber);
    console.log("Tx:", positionOpenEvent.transactionHash);
    console.log();

    if (openData.addressItems && openData.addressItems.items) {
        console.log("📍 Addresses:");
        for (const addr of openData.addressItems.items) {
            console.log("  ", addr.key + ":", addr.value);
        }
        console.log();
    }

    if (openData.uintItems && openData.uintItems.items) {
        console.log("🔢 Numbers:");
        for (const uint of openData.uintItems.items) {
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

    if (openData.intItems && openData.intItems.items) {
        console.log("➕➖ Signed Numbers:");
        for (const int of openData.intItems.items) {
            const key = int.key;
            const value = int.value;

            if (key.includes("Usd") || key.includes("USD")) {
                const absValue = value.lt(0) ? value.mul(-1) : value;
                console.log("  ", key + ":", ethers.utils.formatUnits(absValue, 30), value.lt(0) ? "(negative)" : "USD");
            } else {
                console.log("  ", key + ":", value.toString());
            }
        }
        console.log();
    }

    if (openData.boolItems && openData.boolItems.items) {
        console.log("✓ Flags:");
        for (const bool of openData.boolItems.items) {
            console.log("  ", bool.key + ":", bool.value);
        }
        console.log();
    }

    console.log("=".repeat(80));
    console.log("\n📉 POSITION LIQUIDATED:\n");

    const closeData = positionCloseEvent.args.eventData;
    console.log("Block:", positionCloseEvent.blockNumber);
    console.log("Tx:", positionCloseEvent.transactionHash);
    console.log();

    if (closeData.addressItems && closeData.addressItems.items) {
        console.log("📍 Addresses:");
        for (const addr of closeData.addressItems.items) {
            console.log("  ", addr.key + ":", addr.value);
        }
        console.log();
    }

    if (closeData.uintItems && closeData.uintItems.items) {
        console.log("🔢 Numbers:");
        for (const uint of closeData.uintItems.items) {
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

    if (closeData.intItems && closeData.intItems.items) {
        console.log("➕➖ Signed Numbers:");
        for (const int of closeData.intItems.items) {
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

    if (closeData.boolItems && closeData.boolItems.items) {
        console.log("✓ Flags:");
        for (const bool of closeData.boolItems.items) {
            console.log("  ", bool.key + ":", bool.value);
        }
        console.log();
    }

    console.log("=".repeat(80));
    console.log("\n📊 SUMMARY:\n");

    // Calculate key metrics
    let entryPrice = null;
    let liquidationPrice = null;
    let sizeUsd = null;
    let collateral = null;
    let basePnl = null;

    if (openData.uintItems && openData.uintItems.items) {
        for (const uint of openData.uintItems.items) {
            if (uint.key === "executionPrice") entryPrice = uint.value;
            if (uint.key === "sizeDeltaUsd") sizeUsd = uint.value;
            if (uint.key === "collateralAmount") collateral = uint.value;
        }
    }

    if (closeData.uintItems && closeData.uintItems.items) {
        for (const uint of closeData.uintItems.items) {
            if (uint.key === "executionPrice") liquidationPrice = uint.value;
        }
    }

    if (closeData.intItems && closeData.intItems.items) {
        for (const int of closeData.intItems.items) {
            if (int.key === "basePnlUsd") basePnl = int.value;
        }
    }

    if (entryPrice && liquidationPrice) {
        const entryFormatted = parseFloat(ethers.utils.formatUnits(entryPrice, 30));
        const liquidationFormatted = parseFloat(ethers.utils.formatUnits(liquidationPrice, 30));
        const priceChange = ((liquidationFormatted - entryFormatted) / entryFormatted) * 100;

        console.log("Entry Price:", entryFormatted.toFixed(18));
        console.log("Liquidation Price:", liquidationFormatted.toFixed(18));
        console.log("Price Change:", priceChange.toFixed(2) + "%");
    }

    if (sizeUsd && collateral) {
        const leverage = parseFloat(ethers.utils.formatUnits(sizeUsd, 30)) / parseFloat(ethers.utils.formatUnits(collateral, 6));
        console.log("Leverage:", leverage.toFixed(2) + "x");
    }

    if (basePnl) {
        const absValue = basePnl.lt(0) ? basePnl.mul(-1) : basePnl;
        console.log("Final PnL:", (basePnl.lt(0) ? "-" : "+") + ethers.utils.formatUnits(absValue, 30), "USD");
    }

    console.log();
}

main().catch(console.error);
