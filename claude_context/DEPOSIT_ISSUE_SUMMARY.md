# GMX V2 Deposit Issue - Detailed Summary

## Date: 2025-09-20

## Objective
Deploy 100 USDT liquidity into the USDTNGN perpetual market on GMX V2 (Arbitrum Sepolia) to enable liquidity provision and eventually trading.

## Current Status: BLOCKED
Despite multiple configuration fixes and different approaches, we cannot successfully create a deposit. The transaction either reverts during gas estimation or fails on-chain.

## Contract Addresses (from deployments/marks/arbitrumSepolia)
- **USDT**: `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6`
- **Market**: `0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970`
- **Router**: `0x200882043647295a21F9202f9C1535BfB2A2f127`
- **ExchangeRouter**: `0x59b94d5B4686D59a4665d1679A8E27F71c544F40`
- **DepositHandler**: `0x3Bc412Ad515432cb3ddbD74bf1792971b156c827`
- **DepositVault**: `0x9986771384aeA06185960C5CACA7AFcb47bCC47d`
- **DataStore**: `0x678FE2874cB82e6B44B7fF62C0f8638B86C462da`
- **RoleStore**: `0xa826CBeE8Fb3b1EBC4b032569BD965C72a97Cc24`

## Issues Encountered & Solutions Attempted

### 1. Initial Router Address Confusion
**Issue**: Scripts were using wrong Router address (`0x8209...` instead of `0x2008...`)
**Solution**: ✅ Corrected to use Router from deployments folder
**Result**: Moved to next error

### 2. Market Not Registered
**Issue**: Market wasn't found in DataStore (0 markets returned)
**Solution**: ✅ Registered market with correct key format
```javascript
keccak256(abi.encode(marketAddress, "MARKET_TOKEN"))
```
**Result**: Market now registered, moved to next error

### 3. Missing Critical Configurations
**Issue**: Multiple missing DataStore configurations causing `Unauthorized(address(0))` errors

**Solutions Applied**:
- ✅ Set `WNT` to WETH address
- ✅ Set `FEE_RECEIVER` to deployer address
- ✅ Set `SWAP_FEE_RECEIVER_FACTOR` to 50%
- ✅ Set `SWAP_HANDLER` address
- ✅ Set `HOLDING_ADDRESS` to deployer address
- ✅ Set gas configuration parameters
- ✅ Fixed market data key formats (MARKET_TOKEN, INDEX_TOKEN, LONG_TOKEN, SHORT_TOKEN)

**Result**: Configurations complete, but deposit still fails

### 4. Token Transfer Flow Confusion
**Issue**: Unclear how tokens should be transferred for deposit

**Approaches Tried**:

#### Approach A: Manual Router Transfer
```javascript
router.pluginTransfer(USDT, signer, DEPOSIT_VAULT, amount)
exchangeRouter.createDeposit(params)
```
**Result**: ❌ Failed - Signer lacks ROUTER_PLUGIN role

#### Approach B: Direct Approval and Create
```javascript
usdt.approve(ROUTER, amount)
exchangeRouter.createDeposit(params)
```
**Result**: ❌ Transaction sent but reverted on-chain (0xe123f3f2...)

#### Approach C: Direct Transfer to Vault (Attempted)
```javascript
usdt.transfer(DEPOSIT_VAULT, amount)  // Transfer first
exchangeRouter.createDeposit(params)   // Then create deposit
```
**Result**: Not executed - stopped for review

## Key Discoveries

### 1. Token Flow Understanding
The deposit flow expects:
1. Tokens to be in DepositVault BEFORE createDeposit is called
2. DepositUtils.createDeposit() calls `depositVault.recordTransferIn()` to detect transferred tokens
3. The amount detected determines the deposit size

### 2. Role Requirements
- **ExchangeRouter** needs `CONTROLLER` role on DepositHandler ✅
- **Router** needs `ROUTER_PLUGIN` role ✅
- **DepositVault** needs `BANK_KEEPER` role ✅
- **Keeper** needs `ORDER_KEEPER` role for execution

### 3. Parameter Structure
Correct parameter structure for createDeposit:
```javascript
{
  addresses: {
    receiver, callbackContract, uiFeeReceiver, market,
    initialLongToken, initialShortToken,
    longTokenSwapPath, shortTokenSwapPath
  },
  minMarketTokens, shouldUnwrapNativeToken,
  executionFee, callbackGasLimit, dataList
}
```

## Current Blockers

1. **Unclear Token Transfer Mechanism**:
   - How should tokens get from user wallet to DepositVault?
   - Router.pluginTransfer requires ROUTER_PLUGIN role for caller
   - Direct approval to Router doesn't seem to work
   - Direct transfer might work but needs testing

2. **Transaction Reverting Without Clear Error**:
   - Transaction 0xe123f3f2... reverted on-chain
   - No clear error message in logs
   - Gas estimation sometimes fails, sometimes succeeds

3. **Missing Documentation**:
   - No clear examples of programmatic deposit creation
   - Existing scripts assume UI/keeper infrastructure

## Accumulated Issues
- 801 USDT stuck in DepositVault from failed attempts
- Multiple failed transactions consuming gas
- Uncertainty about correct flow

## Next Steps to Try

1. **Direct Transfer Method**: Transfer USDT directly to DepositVault, then call createDeposit
2. **Grant ROUTER_PLUGIN to Signer**: Allow signer to call pluginTransfer
3. **Use SendWnt/SendTokens**: Find and use proper Router methods for token transfer
4. **Debug On-Chain Revert**: Use tenderly or local fork to debug exact revert reason
5. **Check for Missing Configs**: There may be other DataStore configs we haven't identified

## Files Created
All scripts saved in `/claude_context/scripts/`:
- `test-liquidity-deposit.js` - Original attempt
- `check-missing-config.js` - Config checker
- `fix-fee-receiver.js` - Set FEE_RECEIVER
- `fix-swap-handler.js` - Set SWAP_HANDLER
- `fix-holding-address.js` - Set HOLDING_ADDRESS
- `simple-deposit-test.js` - Standard flow attempt
- `test-deposit-detailed.js` - Detailed error capture
- `decode-error.js` - Error decoder
- `deposit-correct-flow.js` - Direct transfer approach (not executed)

## Documentation Created
- `DEPOSIT_REQUIREMENTS.md` - Complete requirements analysis
- `DEPOSIT_ISSUE_SUMMARY.md` - This summary

## Recommendation
The core issue appears to be understanding the exact token transfer mechanism GMX V2 expects. The system seems designed for Router-based transfers, but the authorization model isn't clear. Consider:

1. Reviewing GMX V2 integration tests for examples
2. Checking if there's a multicall pattern we're missing
3. Exploring if ExchangeRouter should handle the entire flow differently
4. Potentially reaching out to GMX team or checking their Discord for integration guidance