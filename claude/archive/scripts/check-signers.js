const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const oracleStoreAddr = "0x3515052c8ba177610628E79a83C15F889F2627c2";
    
    console.log("=== CHECKING ORACLE SIGNERS ===");
    console.log("Deployer:", deployer.address);
    console.log("OracleStore:", oracleStoreAddr);
    
    const oracleStore = await ethers.getContractAt("OracleStore", oracleStoreAddr);
    
    // Try to get signer count
    try {
        const signerCount = await oracleStore.getSignerCount();
        console.log("\nTotal signers:", signerCount.toString());
        
        if (signerCount.gt(0)) {
            console.log("\nCurrent signers:");
            for (let i = 0; i < signerCount.toNumber(); i++) {
                const signer = await oracleStore.getSigner(i);
                console.log(`  [${i}]: ${signer}`);
                if (signer.toLowerCase() === deployer.address.toLowerCase()) {
                    console.log("       ^ This is the deployer");
                }
            }
        } else {
            console.log("\nNo signers configured yet");
        }
    } catch (e) {
        console.log("\nError getting signer count:", e.message);
    }
}

main().then(() => process.exit(0)).catch(error => {
    console.error(error);
    process.exit(1);
});
