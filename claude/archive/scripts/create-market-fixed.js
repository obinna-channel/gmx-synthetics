const { ethers } = require("hardhat");

async function main() {
    console.log("=== CREATING USDTNGN MARKET ===\n");

    const ADDRESSES = {
        MARKET_FACTORY: "0x6691AFCa903E83996493283ab827DE22E9018959",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"
    };

    const [deployer] = await ethers.getSigners();
    const marketFactory = await ethers.getContractAt("MarketFactory", ADDRESSES.MARKET_FACTORY);
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    // Convert "PERP" to bytes32
    const marketType = ethers.utils.formatBytes32String("PERP");

    console.log("Creating perpetual market:");
    console.log("  Index: sNGN");
    console.log("  Collateral: USDT");

    try {
        const tx = await marketFactory.createMarket(
            ADDRESSES.sNGN,   // index token
            ADDRESSES.USDT,   // long token
            ADDRESSES.USDT,   // short token
            marketType        // bytes32 market type
        );
        
        const receipt = await tx.wait();
        console.log("\n✅ Market created! Tx:", receipt.transactionHash);

        // Get the market address from events
        for (const event of receipt.events || []) {
            if (event.event === "MarketCreated") {
                console.log("\n🎯 NEW MARKET ADDRESS:", event.args.marketToken);
                console.log("\nSave this address for deposits!");
                break;
            }
        }

    } catch (error) {
        console.log("❌ Error:", error.reason || error.message);
        if (error.message.includes("Unauthorized")) {
            console.log("\nNeed MARKET_KEEPER role to create markets");
        }
    }
}

main().catch(console.error);
