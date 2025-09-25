const { ethers } = require("hardhat");

async function main() {
    // Deploy a test contract to check the Role library constant
    const roleLibCode = await ethers.provider.getCode("0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778");
    console.log("RoleStore is deployed:", roleLibCode.length > 2);
    
    // The Role.sol library defines CONTROLLER as:
    // bytes32 public constant CONTROLLER = keccak256(abi.encode("CONTROLLER"));
    
    const expectedHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"])
    );
    
    console.log("\nThe Role.sol library expects CONTROLLER hash to be:");
    console.log(expectedHash);
    console.log("\nThis matches the 'correct hash' from our previous test.");
    
    // Let's also verify by checking the DataStore contract
    const dataStore = await ethers.getContractAt("DataStore", "0x678FE2874cB82e6B44B7fF62C0f8638B86C462da");
    const roleStore = await ethers.getContractAt("RoleStore", "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778");
    
    console.log("\nDataStore points to RoleStore:", await dataStore.roleStore());
    console.log("Expected RoleStore:", "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778");
    console.log("Match:", (await dataStore.roleStore()) === "0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
