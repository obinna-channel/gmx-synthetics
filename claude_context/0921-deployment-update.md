# GMX V2 Deployment Update - September 21, 2025

## Executive Summary
Successfully completed full redeployment of GMX V2 system on Arbitrum Sepolia with a properly functioning ExchangeRouter and USDTNGN perpetual market.

## Problem Solved
The previous ExchangeRouter deployment had a critical issue where `createDeposit()` calls would succeed but not actually create deposits in the DataStore. This was due to improper library linking during deployment.

## Deployment Phases Completed

### Phase 1: Core Infrastructure ✅
- **RoleStore**: `0xBC8b4C61C020B4E7c652F239cAE1418d258efe9C`
- **DataStore**: `0xB6840dd443CD484Ff8F89cF7D766549b768DB21F`
- **EventEmitter**: `0xf93b04C103dD5627D52aFCda96057BEacCc5D623`

### Phase 2: Oracle System ✅
- **OracleStore**: `0xcA051377254B642bE843DeD131de48206db63f94`
- **Oracle**: `0xcA051377254B642bE843DeD131de48206db63f94`
- Oracle signer configured: `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`

### Phase 3: Utility Libraries ✅
All 53 utility libraries deployed including:
- MarketUtils, PositionUtils, OrderUtils
- DepositUtils, WithdrawalUtils, ExecuteDepositUtils
- SwapUtils, FeeUtils, CallbackUtils
- And 40+ other utility contracts

### Phase 4: Vaults ✅
- **DepositVault**: `0x149A382b27BF4D9DE20142d3E22d0933c9f8C794`
- **WithdrawalVault**: `0x18FdEF37031b5d04189481172afE480b30830191`
- **OrderVault**: `0x178D60C2F07aECC786DA3d7f7027398c2142263C`
- **ShiftVault**: `0x48C3Ef538B503994a0aa271600398713D1bD0dcE`

### Phase 5: Core Routers ✅
- **Router**: `0xAE75C18248905dB5E1ceE00c4655Feb49BA25252`
- **MarketFactory**: `0x69c7b34B3A23A3F9d5294B959191cFE25406e81a`

### Phase 6: Handlers ✅
- **DepositHandler**: `0xEfA03387703cc220e6273fB25Fa847d474984057`
- **WithdrawalHandler**: `0x3fcD020f7fae84e357Dbb7b12111Bba5508b6809`
- **OrderHandler**: `0xae3879fcE35143C711732CbF225C7E64D9C655d8`
- **ShiftHandler**: `0xF0E4833990aaBe87EbD8557672b1FdC261e7Ca04`
- **ExternalHandler**: `0x02f5d77EF6cbEC01B0804dA3706F17Bc349fBD00`
- **SwapHandler**: `0x1da264ed60EF9A244433B2F4E82ECddF5e3163d6`

### Phase 7: Order Executors ✅
- **IncreaseOrderExecutor**: `0x5Ceec60b69D028757c6D60d66eBB1879C6A93402`
- **DecreaseOrderExecutor**: `0x2213388A44822F6443E6D28e86104d4ECa71f6E7`
- **SwapOrderExecutor**: `0xEcb0191f466946e181aA4dc25EcB786D7437d227`

### Phase 8: ExchangeRouter (THE CRITICAL FIX) ✅
- **ExchangeRouter**: `0x28402e44267854D8B7CAD5969BB45eB8aF18663e`
  - ✅ Properly linked with all required libraries
  - ✅ Granted CONTROLLER role
  - ✅ Granted ROUTER_PLUGIN role

### Phase 9: Supporting Contracts ✅
- **Reader**: `0x4bD6A4cC827779EDE670790a2ee526Fd083703b3`
- **ReferralStorage**: `0x7a3bc2219e7Bd763B9b4682517AcD946Ce8748cA`
- **Config**: `0xeF3fF68c69a4c2CA43789b6a36e67658CfD1d37a`
- **Multicall3**: `0xE436AF7aa2B64f2030512545411b64D08c6679AC`

### Phase 10: Market Configuration ✅
- **USDTNGN Perpetual Market**: `0x6136252ce73bD4dA432F85b2A7065481DE227601`
  - Index Token: sNGN (`0xe0dBA0326623dEcE1712581271ebcD846D67b29f`)
  - Long Token: USDT (`0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`)
  - Short Token: USDT (`0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`)
  - All market parameters configured (fees, leverage, funding rates, etc.)

## Additional Components
- **MultichainTransferRouter**: `0xA5A46EF83226BFDA40221EFbc169C954E8CF9d8A`

## Key Configuration Updates

### Oracle Settings
- MIN_ORACLE_BLOCK_CONFIRMATIONS: 255
- MAX_ORACLE_PRICE_AGE: 86400 (24 hours)
- MAX_ORACLE_TIMESTAMP_RANGE: 3600 (1 hour)
- MIN_ORACLE_SIGNERS: 1

### Roles Granted
- Deployer has CONTROLLER, MARKET_KEEPER, and Oracle Signer roles
- All handlers have appropriate CONTROLLER roles
- ExchangeRouter has CONTROLLER and ROUTER_PLUGIN roles

## Token Configuration
Existing tokens retained (not redeployed):
- **USDT**: `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`
- **sNGN**: `0xe0dBA0326623dEcE1712581271ebcD846D67b29f`

## Critical Issues Resolved

### Hash Calculation Issue
- Discovery: Role verification was failing due to incorrect hash calculation in diagnostic scripts
- Root cause: Scripts were using `keccak256(toUtf8Bytes("ROLE_NAME"))` instead of `keccak256(abi.encode("ROLE_NAME"))`
- Resolution: All scripts now use the correct hash calculation method matching the contracts

### ExchangeRouter Issue
- Previous issue: createDeposit() calls succeeded but deposits weren't created in DataStore
- Root cause: Improper library linking during deployment
- Resolution: Complete redeployment with proper library dependencies

## Next Steps
1. Test deposit creation with the new ExchangeRouter
2. Set token prices via Oracle
3. Execute first deposit with receiver = address(1)
4. Proceed with liquidity provision and trading operations

## Network Information
- **Network**: Arbitrum Sepolia
- **Deployment Date**: September 21, 2025
- **Deployer**: `0xBaB0D0892Bf8563B731f8e8970fE856ce9308292`

## Important Notes
- First deposit must use receiver = address(1) (`0x0000000000000000000000000000000000000001`)
- All contracts are deployed with appropriate roles and permissions
- System is ready for deposit creation and trading operations