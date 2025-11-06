const { ethers } = require('hardhat');

async function main() {
    const MOCK_PROVIDER = '0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5';

    const mockProvider = await ethers.getContractAt('contracts/oracle/MockOracleProvider.sol:MockOracleProvider', MOCK_PROVIDER);

    const owner = await mockProvider.owner();

    console.log('MockOracleProvider:', MOCK_PROVIDER);
    console.log('Owner:', owner);

    // Check if it matches deployer
    const DEPLOYER = '0xBaB0D0892Bf8563B731f8e8970fE856ce9308292';
    console.log('Is deployer the owner?', owner.toLowerCase() === DEPLOYER.toLowerCase() ? '✅ YES' : '❌ NO');
}

main().catch(console.error);
