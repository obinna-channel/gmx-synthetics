const { ethers } = require('hardhat');

async function main() {
    const ROLE_STORE = '0x4943c063691259B677f3D7BC808C9C3090321EbB';
    const ADDRESS_TO_CHECK = '0xBaB0D0892Bf8563B731f8e8970fE856ce9308292';

    const roleStore = await ethers.getContractAt('RoleStore', ROLE_STORE);

    const ORDER_KEEPER = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['string'], ['ORDER_KEEPER'])
    );

    const hasRole = await roleStore.hasRole(ADDRESS_TO_CHECK, ORDER_KEEPER);

    console.log('Address:', ADDRESS_TO_CHECK);
    console.log('Has ORDER_KEEPER role:', hasRole ? '✅ YES' : '❌ NO');
}

main().catch(console.error);
