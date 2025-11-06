const { ethers } = require("hardhat");

const ADDRESSES = {
    DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111",
    READER: "0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8",
    REFERRAL_STORAGE: "0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547",
    
    TSLA_MARKET: "0x8ae559448a1482faffC925eF6a233276588348Df",
    USDTARS_MARKET: "0xa97A12dcfFB8aB49BDa3198B0D9FD0A3563c4D69",
    USDTNGN_MARKET: "0x5E63276Caae0FF49b2762b98A1d37941AA50F804",
    
    mUSD: "0x85bf04B07A6df0172372b959C1C73F3e90F73faf",
};

const ACCOUNT = "0x3Bcc96fc2A86043D228c61A5C92f401B25CECE44";

async function checkFundingUpdates() {
    const reader = await ethers.getContractAt("Reader", ADDRESSES.READER);
    const dataStore = await ethers.getContractAt("DataStore", ADDRESSES.DATA_STORE);

    console.log("\n=== Checking Funding Update Status ===\n");

    // Get positions with timestamps
    const allMarkets = [ADDRESSES.TSLA_MARKET, ADDRESSES.USDTNGN_MARKET, ADDRESSES.USDTARS_MARKET];
    const marketPrices = [
        { // TSLA
            indexTokenPrice: { min: ethers.utils.parseUnits("407", 12), max: ethers.utils.parseUnits("407", 12) },
            longTokenPrice: { min: ethers.utils.parseUnits("1", 24), max: ethers.utils.parseUnits("1", 24) },
            shortTokenPrice: { min: ethers.utils.parseUnits("1", 24), max: ethers.utils.parseUnits("1", 24) }
        },
        { // USDTNGN
            indexTokenPrice: { min: ethers.utils.parseUnits("1500", 12), max: ethers.utils.parseUnits("1500", 12) },
            longTokenPrice: { min: ethers.utils.parseUnits("1", 24), max: ethers.utils.parseUnits("1", 24) },
            shortTokenPrice: { min: ethers.utils.parseUnits((1/1500).toFixed(12), 12), max: ethers.utils.parseUnits((1/1500).toFixed(12), 12) }
        },
        { // USDTARS
            indexTokenPrice: { min: ethers.utils.parseUnits("1000", 12), max: ethers.utils.parseUnits("1000", 12) },
            longTokenPrice: { min: ethers.utils.parseUnits("1", 24), max: ethers.utils.parseUnits("1", 24) },
            shortTokenPrice: { min: ethers.utils.parseUnits("1", 24), max: ethers.utils.parseUnits("1", 24) }
        }
    ];

    const positionInfoList = await reader.getAccountPositionInfoList(
        ADDRESSES.DATA_STORE,
        ADDRESSES.REFERRAL_STORAGE,
        ACCOUNT,
        allMarkets,
        marketPrices,
        ethers.constants.AddressZero,
        0,
        1000
    );

    const currentBlock = await ethers.provider.getBlockNumber();
    const currentBlockData = await ethers.provider.getBlock(currentBlock);
    const currentTime = currentBlockData.timestamp;

    console.log("Current Time:", new Date(currentTime * 1000).toISOString());
    console.log("Current Block:", currentBlock, "\n");

    for (let i = 0; i < positionInfoList.length; i++) {
        const positionInfo = positionInfoList[i];
        const { position, fees } = positionInfo;
        const { addresses, numbers, flags } = position;

        let marketName = "UNKNOWN";
        if (addresses.market.toLowerCase() === ADDRESSES.TSLA_MARKET.toLowerCase()) marketName = "TSLA";
        else if (addresses.market.toLowerCase() === ADDRESSES.USDTNGN_MARKET.toLowerCase()) marketName = "USDTNGN";
        else if (addresses.market.toLowerCase() === ADDRESSES.USDTARS_MARKET.toLowerCase()) marketName = "USDTARS";

        const createdTime = numbers.increasedAtTime.toNumber();
        const ageSeconds = currentTime - createdTime;
        const ageHours = ageSeconds / 3600;
        const ageDays = ageHours / 24;

        console.log(`=== ${marketName} ${flags.isLong ? 'LONG' : 'SHORT'} ===`);
        console.log(`  Position opened at: ${new Date(createdTime * 1000).toISOString()}`);
        console.log(`  Position age: ${ageDays.toFixed(2)} days (${ageHours.toFixed(1)} hours, ${ageSeconds} seconds)`);
        console.log(`  Position fundingFeeAmountPerSize: ${numbers.fundingFeeAmountPerSize.toString()}`);
        console.log(`  Latest market fundingFeeAmountPerSize: ${fees.funding.latestFundingFeeAmountPerSize.toString()}`);
        console.log(`  Difference: ${fees.funding.latestFundingFeeAmountPerSize.sub(numbers.fundingFeeAmountPerSize).toString()}`);
        console.log(`  Funding accumulated: $${ethers.utils.formatUnits(fees.funding.fundingFeeAmount, 30)}\n`);
    }

    // Check funding updated at timestamp
    const BASE_KEY = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["FUNDING_UPDATED_AT"]));
    
    for (const market of allMarkets) {
        const key = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [BASE_KEY, market]));
        const fundingUpdatedAt = await dataStore.getUint(key);
        
        let marketName = "UNKNOWN";
        if (market.toLowerCase() === ADDRESSES.TSLA_MARKET.toLowerCase()) marketName = "TSLA";
        else if (market.toLowerCase() === ADDRESSES.USDTNGN_MARKET.toLowerCase()) marketName = "USDTNGN";
        else if (market.toLowerCase() === ADDRESSES.USDTARS_MARKET.toLowerCase()) marketName = "USDTARS";
        
        const timeSinceUpdate = currentTime - fundingUpdatedAt.toNumber();
        
        console.log(`${marketName} Market Funding:`);
        console.log(`  Last updated: ${fundingUpdatedAt.toNumber() > 0 ? new Date(fundingUpdatedAt.toNumber() * 1000).toISOString() : 'Never'}`);
        console.log(`  Time since update: ${timeSinceUpdate} seconds (${(timeSinceUpdate / 3600).toFixed(2)} hours)\n`);
    }
}

async function main() {
    try {
        await checkFundingUpdates();
    } catch (error) {
        console.error("Error:", error.message);
        console.error(error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
