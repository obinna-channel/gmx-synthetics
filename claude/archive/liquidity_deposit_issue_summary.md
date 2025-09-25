# USDTNGN Market Liquidity Deposit Issue Summary

## Executive Summary
The USDTNGN perpetual market on our GMX V2 fork (Arbitrum Sepolia) is currently unable to accept any liquidity deposits after the initial market initialization. All deposit attempts, regardless of size, are being automatically cancelled and refunded during execution.

## Current Market State

### Market Configuration
- **Market Address**: `0x6136252ce73bD4dA432F85b2A7065481DE227601`
- **Index Token**: sNGN (`0xe0dBA0326623dEcE1712581271ebcD846D67b29f`)
- **Long Token**: USDT (`0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`)
- **Short Token**: USDT (`0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`)
- **Type**: Single-token market (same long and short token)

### Current Pool Status
- **Market Token Supply**: 999,300 tokens
- **USDT in Pool**: 1 USDT
- **Market Initialized**: Yes (with 1 USDT first deposit to address(1))

## Observed Behavior

### What Works
- Market deployment successful
- Initial deposit of 1 USDT succeeded (created 999,300 market tokens)
- Deposit creation transactions succeed
- Oracle price setting works correctly

### What Fails
- All subsequent deposit executions fail
- USDT is refunded to depositor after each failed execution
- No market tokens are minted beyond initial supply
- No error messages visible on-chain

## Testing Performed

### Deposit Configurations Attempted

| Amount | Configuration | Result |
|--------|--------------|--------|
| 0.5 USDT | Short-only, single transfer | Created ✅, Execution failed ❌, Refunded |
| 1 USDT | Long-only | Created ✅, Execution failed ❌, Refunded |
| 1 USDT | Short-only | Created ✅, Execution failed ❌, Refunded |
| 2 USDT | Balanced (1L/1S) | Created ✅, Execution failed ❌, Refunded |
| 10 USDT | Long-only | Created ✅, Execution failed ❌, Refunded |
| 100 USDT | Long-only (initial attempt) | Created ✅, Execution failed ❌, Refunded |
| 1,000 USDT | Long-only | Created ✅, Execution failed ❌, Refunded |
| 1,000,000 USDT | Balanced (500K L/500K S) | Created ✅, Execution failed ❌, Refunded |

### Transaction Pattern
1. **Deposit Creation**: User calls `ExchangeRouter.createDeposit()` - Always succeeds
2. **Deposit Execution**: Keeper calls `DepositHandler.executeDeposit()` - Always fails silently
3. **Refund**: USDT automatically returned to depositor

## Technical Observations

### Successful Initial Deposit
- Amount: 1 USDT
- Receiver: `0x0000000000000000000000000000000000000001` (address(1))
- Market Tokens Created: 999,300
- Execution Fee: 0

### Failed Subsequent Deposits
- All amounts from 0.5 to 1,000,000 USDT fail
- Both single-sided and balanced deposits fail
- Correct oracle prices set (USDT = $1, sNGN = 1500)
- Proper approvals and token transfers confirmed
- DepositVault receives tokens correctly before execution

### Error Handling
- Execution fails within a try-catch block
- Error is caught and handled silently
- `DepositUtils.cancelDeposit()` is called
- USDT is refunded via `TokenUtils.sendTokens()`

## Configuration Parameters

### Oracle Settings
```
MIN_ORACLE_SIGNERS: 1
MAX_ORACLE_PRICE_AGE: 86400 (24 hours)
REQUEST_EXPIRATION_TIME: 3600 (1 hour)
```

### Market Parameters
```
MAX_PNL_FACTOR_FOR_DEPOSITS: 50%
Single-token market (USDT for both long and short)
```

## Impact
- Market cannot accept liquidity providers
- Trading cannot commence without liquidity
- Market tokens cannot be minted beyond initial supply
- Pool remains at 1 USDT backing 999,300 tokens

## Related Contract Addresses
- **Market**: `0x6136252ce73bD4dA432F85b2A7065481DE227601`
- **DepositHandler**: `0xEfA03387703cc220e6273fB25Fa847d474984057`
- **ExchangeRouter**: `0x28402e44267854D8B7CAD5969BB45eB8aF18663e`
- **Router**: `0xAE75C18248905dB5E1ceE00c4655Feb49BA25252`
- **DataStore**: `0xB6840dd443CD484Ff8F89cF7D766549b768DB21F`
- **DepositVault**: `0x149A382b27BF4D9DE20142d3E22d0933c9f8C794`

## Reproduction Steps
1. Approve Router to spend USDT
2. Call `ExchangeRouter.sendTokens()` to transfer USDT to DepositVault
3. Call `ExchangeRouter.createDeposit()` with deposit parameters
4. Set oracle prices (USDT = $1, sNGN = 1500)
5. Call `DepositHandler.executeDeposit()` with oracle parameters
6. Observe: Transaction succeeds but USDT is refunded, no market tokens received

---
*Document prepared: September 22, 2025*
*Network: Arbitrum Sepolia*
*GMX V2 Fork Deployment*