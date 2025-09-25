const { ethers } = require("hardhat");

async function main() {
    console.log("=== Checking Which Oracle DepositHandler Uses ===\n");
    
    const DEPOSIT_HANDLER = "0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00";
    const DATA_STORE = "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111";
    
    const depositHandler = await ethers.getContractAt("DepositHandler", DEPOSIT_HANDLER);
    const dataStore = await ethers.getContractAt("DataStore", DATA_STORE);
    
    // Check which Oracle the DepositHandler references
    console.log("DepositHandler address:", DEPOSIT_HANDLER);
    
    try {
        // Try to get oracle from DepositHandler
        const oracle = await depositHandler.oracle();
        console.log("Oracle from DepositHandler.oracle():", oracle);
    } catch (e) {
        console.log("No direct oracle() function on DepositHandler");
    }
    
    // Check DataStore for Oracle address
    console.log("\nChecking DataStore for Oracle configuration...");
    
    // The Oracle we've been setting prices on
    const ORACLE_WE_USE = "0xE89d94669f49D278cCD094A084139eB6639C0a93";
    console.log("Oracle we've been using:", ORACLE_WE_USE);
    
    // Check if there's a different Oracle registered
    // Look for deployed Oracle from deployments
    console.log("\nChecking deployed contracts...");
    
    // Let's read the Oracle deployment file to see what was deployed
    try {
        const fs = require('fs');
        const oracleDeployment = JSON.parse(
            fs.readFileSync('deployments/marks/arbitrumSepolia/Oracle.json', 'utf8')
        );
        console.log("Oracle from deployment file:", oracleDeployment.address);
        
        // Compare
        if (oracleDeployment.address.toLowerCase() === ORACLE_WE_USE.toLowerCase()) {
            console.log("✅ We're using the correct deployed Oracle");
        } else {
            console.log("❌ MISMATCH! We might be using wrong Oracle");
        }
    } catch (e) {
        console.log("Could not read Oracle deployment file");
    }
    
    // Check the DepositHandler's constructor parameters
    console.log("\nChecking DepositHandler constructor parameters...");
    try {
        const fs = require('fs');
        const depositHandlerDeployment = JSON.parse(
            fs.readFileSync('deployments/marks/arbitrumSepolia/DepositHandler.json', 'utf8')
        );
        
        if (depositHandlerDeployment.args) {
            console.log("DepositHandler constructor args:");
            depositHandlerDeployment.args.forEach((arg, i) => {
                console.log(`  Arg ${i}:`, arg);
            });
        }
    } catch (e) {
        console.log("Could not read DepositHandler deployment args");
    }
    
    // Try to decode which Oracle is being used in the execution
    console.log("\n📍 Key insight:");
    console.log("The error 'OracleBlockNumbersAreSmallerThanRequired' comes from");
    console.log("the Oracle contract when DepositHandler calls oracle.setPrices()");
    console.log("during deposit execution.");
    
    console.log("\nThe Oracle expects block numbers to be passed with prices,");
    console.log("but setPrimaryPrice() doesn't update block numbers.");
}

main().catch(console.error);