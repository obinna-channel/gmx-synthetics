const { ethers } = require("hardhat");

async function main() {
    console.log("=== CREATING USDTNGN MARKET THROUGH MARKETFACTORY ===\n");

    // Addresses from deployments folder
    const ADDRESSES = {
        MARKET_FACTORY: "0x6691AFCa903E83996493283ab827DE22E9018959",
        DATA_STORE: "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da",
        ROLE_STORE: "0xAD5ca3aE69C60b1B699B604DE06AaC96Eb1F8C1b",
        EVENT_EMITTER: "0xFE29E7dA59C4b28052EaC18c96E56f1C685F2D67",
        USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
        sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f"
    };

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const marketFactory = await ethers.getContractAt("MarketFactory", ADDRESSES.MARKET_FACTORY);
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    // Check current market count
    const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));
    const marketCountBefore = await dataStore.getAddressCount(MARKET_LIST_KEY);
    console.log("Markets before:", marketCountBefore.toString());

    // Market parameters
    const indexToken = ADDRESSES.sNGN;  // sNGN as index token for USDTNGN
    const longToken = ADDRESSES.USDT;   // USDT as collateral
    const shortToken = ADDRESSES.USDT;  // Same token market (USDT for both long and short)
    const marketType = "PERP";          // Perpetual market

    console.log("\nCreating market with:");
    console.log("  Index token (sNGN):", indexToken);
    console.log("  Long token (USDT):", longToken);
    console.log("  Short token (USDT):", shortToken);
    console.log("  Type:", marketType);

    try {
        const tx = await marketFactory.createMarket(
            indexToken,
            longToken,
            shortToken,
            marketType
        );
        
        console.log("\nTransaction sent, waiting for confirmation...");
        const receipt = await tx.wait();
        
        console.log("✅ Market created!");
        console.log("  Transaction:", receipt.transactionHash);
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Find MarketCreated event
        const marketCreatedEvent = receipt.events?.find(e => e.event === "MarketCreated");
        if (marketCreatedEvent) {
            const marketAddress = marketCreatedEvent.args.marketToken;
            console.log("\n🎯 New Market Address:", marketAddress);
            console.log("Use this address for deposits!");
        }

        // Check new market count
        const marketCountAfter = await dataStore.getAddressCount(MARKET_LIST_KEY);
        console.log("\nMarkets after:", marketCountAfter.toString());

        // Get the new market details
        if (marketCountAfter.gt(marketCountBefore)) {
            const newMarketAddr = await dataStore.getAddressValuesAt(MARKET_LIST_KEY, marketCountAfter.sub(1), 1);
            console.log("New market in DataStore:", newMarketAddr[0]);
        }

    } catch (error) {
        console.log("\n❌ Error creating market:", error.reason || error.message);
        
        if (error.message.includes("Unauthorized")) {
            console.log("\nYou need MARKET_KEEPER role to create markets.");
            console.log("Grant role using RoleStore contract.");
        }
    }
}

main().catch(console.error);
