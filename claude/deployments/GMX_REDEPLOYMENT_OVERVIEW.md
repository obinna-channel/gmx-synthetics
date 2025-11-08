# GMX V2 Redeployment Project Overview

## Project Objective

Deploy a fork of GMX V2 on Arbitrum Sepolia for the Marks protocol, creating synthetic Nigerian Naira (sNGN) perpetual markets. The goal is to establish a fully functional decentralized perpetuals exchange with USDT as collateral and sNGN as the synthetic asset.

## Deployment Status

### Core Contracts Deployed

All GMX V2 core contracts have been successfully deployed to Arbitrum Sepolia under the `marks` deployment namespace. Key addresses:

- **DataStore**: `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111`
- **EventEmitter**: `0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C`
- **Oracle**: `0xE89d94669f49D278cCD094A084139eB6639C0a93`
- **OracleStore**: `0xBc2408eF555c05A471A8242ef640061910EA4FD0`
- **RoleStore**: `0x4943c063691259B677f3D7BC808C9C3090321EbB`

### Router System
- **Router**: `0xD529301E64C671f6d20E96de88b14D8A87c13cBa`
- **ExchangeRouter**: `0x3B33708e9b8242999459EB9b4756C24c846e5936`

### Vault System
- **DepositVault**: `0x8672091de3AF3a02bE48cFB753810A736D9F6379`
- **OrderVault**: `0xE52E7ad887098C0Fdd09b03a67FB24ceB93a12Ae`
- **WithdrawalVault**: `0xAAE86D82fF1c9c08B526E9d8f5F0b23C656d8965`

### Handlers
- **DepositHandler**: `0xdC3F9dfD8f65E1c986B088b956D16a7A1c6efaa9`
- **OrderHandler**: `0xb6cd890F5d8073e8a97D30BE032e3Db24C63c0B5`
- **WithdrawalHandler**: `0xD86aA616D3ec6d43aB018e93029acD953a7b7f02`

### Executors
- **IncreaseOrderExecutor**: `0xbcD4Ab0A01a93D0a6e95e48dF587e88f8Dc7e7fc`
- **DecreaseOrderExecutor**: `0xf8E9Ace5a33c48d6FA3DFf3e9Dd3a4F51627fbD7`
- **SwapOrderExecutor**: `0x59c76a52F1E9F0FF388dE89B4b1d5c8Caf5f1F4d`

### Market Factory
- **MarketFactory**: `0x2b477989A149B17073D9C9C82eC9cB03591e20c6`

### Custom Tokens Deployed
- **sNGN** (Synthetic Nigerian Naira): `0xd66e60AA5b6982649a116e6944Daec22b15468Ad`
- **USDT** (Test USDT): `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`

### Markets Created

#### Market 1: sNGN [USDT-sNGN]
- **Market Token**: `0x53b49A28054D108d7050B0E5C317001bE984EB2D`
- **Index Token**: sNGN
- **Long Token**: USDT
- **Short Token**: sNGN
- **Type**: Single-token market (USDT only)

#### Market 2: sNGN [USDT-USDT]
- **Market Token**: `0xb1faf4aFd5bd6aA53CF056BBA31CCa1C44234a24`
- **Index Token**: sNGN
- **Long Token**: USDT
- **Short Token**: USDT
- **Type**: Single-token market

### Role Configuration

Roles have been granted as follows:

1. **CONTROLLER Role**: Granted to EOA `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`
2. **MARKET_KEEPER Role**: Granted to EOA `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`
3. **ORDER_KEEPER Role**: Granted to EOA `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`
4. **ROUTER_PLUGIN Role**: Granted to Router contract `0xD529301E64C671f6d20E96de88b14D8A87c13cBa`
5. **BANK_KEEPER Role**: Granted to DepositVault `0x8672091de3AF3a02bE48cFB753810A736D9F6379`

### Oracle Configuration

Price feeds have been configured with:
- 4 oracle signers configured in OracleStore
- Chainlink price feed provider deployed at `0x3cFa5da887DAFEd3Dc76c35ec6b18C5Faaf9e8e5`

## Current Issue: Deposit Creation Failure

### Problem Description

Deposits are failing to be created successfully. When attempting to create a deposit, the transaction either reverts with various errors or fails silently (status: 0) without providing revert reasons.

### What We've Tried

1. **Direct Token Transfer Approach**
   - Transferred USDT directly to DepositVault
   - Called `createDeposit` separately
   - Result: Failed with EmptyDepositAmounts error

2. **Using sendTokens Method**
   - Called `exchangeRouter.sendTokens()` to transfer tokens
   - Then called `createDeposit`
   - Result: Failed with EmptyDepositAmounts error

3. **Multicall Atomic Approach**
   - Combined `sendTokens` and `createDeposit` in a single multicall transaction
   - Based on GMX documentation requirement for atomic execution
   - Result: Transaction fails silently with status: 0

4. **Role Verification**
   - Confirmed ROUTER_PLUGIN role granted to Router
   - Confirmed BANK_KEEPER role granted to DepositVault
   - Confirmed CONTROLLER role granted to EOA
   - All roles verified with correct Solidity-style hash calculations

5. **Market Configuration Verification**
   - Confirmed markets exist in DataStore
   - Fixed hash calculation issues for DataStore keys
   - Verified market tokens are properly configured

6. **Token Approval Adjustments**
   - Initially approved ExchangeRouter
   - Changed to approve Router contract instead
   - Verified sufficient allowances before each attempt

7. **Gas Limit Increase**
   - Increased gas limit to 2,500,000 (following TypeScript example scripts)
   - Transaction still failed, only used 252,341 gas

### Transaction Examples

Failed multicall transaction: `0x8dfbf7dffb3dcc365522e5de811cc19316aa510a3e09d39abf29a7370ead3058`
- Status: 0 (failed)
- Gas Used: 252,341 / 2,500,000
- No revert reason provided

### Scripts Created

Located in `/scripts/marks/`:
- `create-deposit-with-sendtokens.js` - Multicall approach
- `check-market-configuration.js` - Verifies market exists in DataStore
- `check-role-assignments.js` - Verifies all required roles

### Current State

- Tokens successfully reach DepositVault (confirmed via balance checks)
- Market configuration confirmed in DataStore
- All required roles properly configured
- Deposit creation consistently failing at the `createDeposit` step
- No clear error messages in silent failures

## Next Steps

(To be determined after fresh debugging approach)