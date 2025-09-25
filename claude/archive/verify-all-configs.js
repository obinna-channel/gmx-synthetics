const { ethers } = require("hardhat");

async function main() {
    console.log("=== Verifying ALL Configurations ===\n");
    
    const DATA_STORE = "0xB6840dd443CD484Ff8F89cF7D766549b768DB21F";
    const ORACLE = "0x2b44fd56615FFA5F2980cA624871716340762238";
    const MARKET = "0x6136252ce73bD4dA432F85b2A7065481DE227601";
    const USDT = "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6";
    const sNGN = "0xe0dBA0326623dEcE1712581271ebcD846D67b29f";
    
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    const oracle = await ethers.getContractAt("Oracle", ORACLE);
    
    console.log("1️⃣ MIN_ORACLE_SIGNERS:");
    const MIN_ORACLE_SIGNERS = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MIN_ORACLE_SIGNERS"])
    );
    const minSigners = await dataStore.getUint(MIN_ORACLE_SIGNERS);
    console.log("  Value:", minSigners.toString());
    console.log("  Status:", minSigners.eq(0) ? "✅ Set to 0" : "❌ Not 0");
    
    console.log("\n2️⃣ REQUEST_EXPIRATION_TIME:");
    const REQUEST_EXPIRATION_TIME = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["REQUEST_EXPIRATION_TIME"])
    );
    const expirationTime = await dataStore.getUint(REQUEST_EXPIRATION_TIME);
    console.log("  Value:", expirationTime.toString());
    console.log("  Status:", expirationTime.eq(3600) ? "✅ Set to 3600" : "❌ Not 3600");
    
    console.log("\n3️⃣ MAX_PNL_FACTOR_FOR_DEPOSITS:");
    const MAX_PNL_FACTOR = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["MAX_PNL_FACTOR_FOR_DEPOSITS"])
    );
    
    const pnlKeyLong = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_PNL_FACTOR, MARKET, true]
        )
    );
    const pnlKeyShort = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["bytes32", "address", "bool"],
            [MAX_PNL_FACTOR, MARKET, false]
        )
    );
    
    const longFactor = await dataStore.getUint(pnlKeyLong);
    const shortFactor = await dataStore.getUint(pnlKeyShort);
    console.log("  Long:", longFactor.eq(0) ? "❌ Not set" : "✅ " + ethers.utils.formatUnits(longFactor, 28) + "%");
    console.log("  Short:", shortFactor.eq(0) ? "❌ Not set" : "✅ " + ethers.utils.formatUnits(shortFactor, 28) + "%");
    
    console.log("\n4️⃣ ORACLE PRICES:");
    try {
        const usdtPrice = await oracle.getPrimaryPrice(USDT);
        console.log("  USDT: ✅ $" + ethers.utils.formatUnits(usdtPrice.min, 30));
    } catch {
        console.log("  USDT: ❌ Not set");
    }
    
    try {
        const ngnPrice = await oracle.getPrimaryPrice(sNGN);
        console.log("  sNGN: ✅ " + ethers.utils.formatUnits(ngnPrice.min, 30));
    } catch {
        console.log("  sNGN: ❌ Not set");
    }
    
    console.log("\n5️⃣ ORACLE TIMESTAMPS:");
    const minTs = await oracle.minTimestamp();
    const maxTs = await oracle.maxTimestamp();
    const currentTime = Math.floor(Date.now() / 1000);
    const age = currentTime - minTs.toNumber();
    console.log("  Min:", minTs.toString());
    console.log("  Max:", maxTs.toString());
    console.log("  Age:", age, "seconds");
    console.log("  Status:", age < 300 ? "✅ Fresh" : "⚠️ Stale (update needed)");
    
    console.log("\n\n📋 SUMMARY:");
    console.log("All configurations should be ✅ before executing deposit");
}

main().catch(console.error);
