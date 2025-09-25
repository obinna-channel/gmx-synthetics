const { ethers } = require("hardhat");

async function main() {
    const MARKET = "0x2b2e61c36fC825555E85E31a851A24fB6ebE1869";
    
    console.log("Checking if market token contract exists at:", MARKET);
    
    const code = await ethers.provider.getCode(MARKET);
    
    if (code === "0x") {
        console.log("❌ No contract at this address");
    } else {
        console.log("✅ Contract exists at this address");
        console.log("Code length:", code.length, "characters");
        
        // Try to interact with it as an ERC20
        try {
            const market = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", MARKET);
            const name = await market.name();
            const symbol = await market.symbol();
            const totalSupply = await market.totalSupply();
            
            console.log("\nToken details:");
            console.log("  Name:", name);
            console.log("  Symbol:", symbol);
            console.log("  Total Supply:", ethers.utils.formatUnits(totalSupply, 18));
        } catch (e) {
            console.log("\nCouldn't read token details:", e.message);
        }
    }
}

main().catch(console.error);
