# GMX V2 Deposit Issue - UPDATE: Deposit Created, Execution Blocked

## Date: 2025-09-20 (Update)

## Major Breakthrough: Deposit Creation Successful! 🎉

After extensive debugging, we successfully created a deposit on GMX V2. However, we are now blocked at the execution phase.

## What Changed - The Key Discoveries

### 1. The Execution Fee Problem
**Discovery**: The root cause of deposit creation failures was the execution fee handling.

**Why it was failing**:
- We were sending ETH via `msg.value` with the transaction
- ExchangeRouter doesn't forward `msg.value` to DepositHandler
- The validation was checking for execution fee in the params but finding 0
- Error: `InsufficientExecutionFee(provided=0, required=0.01)`

**The Solution**:
- Set `executionFee: 0` in the deposit parameters
- This bypasses the execution fee validation
- The keeper (us with ORDER_KEEPER role) pays gas for execution instead

### 2. Single-Token Market Configuration
**Discovery**: For markets where longToken == shortToken (our USDT/NGN market):
- Must set BOTH `initialLongToken` and `initialShortToken` to USDT
- Cannot use `AddressZero` for short token
- The protocol handles the split internally

### 3. Correct Contract Addresses
**Issue Found**: We were using wrong contract addresses not from deployments
- Wrong RoleStore: `0xa826CBeE8Fb3b1EBC4b032569BD965C72a97Cc24`
- Correct RoleStore: `0xE5AFf784a9F3E551fb3b310FBc26bf2213B36778`
- Wrong Oracle: `0x2FcA59e5219071ef966ab95a3c3e99E857B33c4F`
- Correct Oracle: `0xDfdcE92178464930c591E7558Cf3fAEB10bAe64C`

## Current State - What Works ✅

### Successful Deposit Creation
```javascript
Transaction: 0xbd62a9a987b00e82a9f13a7230fbc5f24c9ef681b70bc48012c5bb4575d1d316
Block: 196488385
Gas Used: 647519
Status: Success

Deposit Parameters Used:
- Market: 0xae76f8e6e99a3384279dc95bd0f3ec5a9b0f5970
- Initial Long Token: USDT
- Initial Short Token: USDT (not AddressZero!)
- Execution Fee: 0 (this was key!)
- Amount: 50 USDT transferred to DepositVault
```

### Deposit Key Successfully Extracted
```
Deposit Key: 0xccee02d31cafad9001fbdc4dd5cf4957e152a372530316a7d856401e4c5d74bd
```

The key was found in EventEmitter logs at topics[1] when topics[2] matched `keccak256("DepositCreated")`

### Configurations Verified
- ✅ ORDER_KEEPER role granted to deployer
- ✅ All DataStore configurations set (FEE_RECEIVER, WNT, etc.)
- ✅ Market properly registered
- ✅ Oracle prices set (USDT = $1, sNGN = 0.000606 USD)
- ✅ 1066 USDT currently in DepositVault (from multiple attempts)

## Current Blocker - Execution Fails ❌

### Failed Execution Attempts
```javascript
Transaction: 0x5ffdfe6d39bb0687b192e6cc153e23ee4571844cb90c33cacec79827affd4c0d
Status: Reverted
Gas Used: 71554

Called: DepositHandler.executeDeposit(
  depositKey,
  oracleParams: {
    signerInfo: 0,
    tokens: [USDT, sNGN],
    providers: [Oracle, Oracle],
    data: []
  }
)
```

### Possible Causes for Execution Failure

1. **Oracle Validation Issues**
   - Prices might need specific timing requirements
   - Oracle timestamp validation might be failing
   - Price format might be incorrect (using 30 decimals)

2. **Empty Deposit Detection**
   - The deposit might be detected as empty
   - `recordTransferIn()` might not be finding the tokens

3. **Market State Issues**
   - First deposit might need special handling
   - Pool value calculation might be failing with 0 liquidity

4. **Execution Fee = 0 Side Effects**
   - The system might expect different behavior when executionFee = 0
   - Keeper execution might have different requirements

## Technical Flow Discovered

### Deposit Creation Flow (Working)
```
1. Transfer USDT to DepositVault
2. Call ExchangeRouter.createDeposit() with executionFee = 0
3. ExchangeRouter → DepositHandler.createDeposit()
4. DepositUtils.createDeposit():
   - Calls depositVault.recordTransferIn() for long token
   - Calls depositVault.recordTransferIn() for short token
   - Creates deposit record
   - Emits DepositCreated event via EventEmitter
   - Returns deposit key
```

### Deposit Execution Flow (Failing)
```
1. Keeper calls DepositHandler.executeDeposit(key, oracleParams)
2. ExecuteDepositUtils.executeDeposit():
   - Validates oracle prices ← MIGHT BE FAILING HERE
   - Calculates pool value ← OR HERE
   - Mints GM tokens
   - Transfers to receiver
```

## Current USDT Distribution
- User Wallet: 1,098,734 USDT
- DepositVault: 1,066 USDT (stuck from attempts)
- Total: ~1,099,800 USDT

## Scripts Created

### Working Scripts
- `complete-deposit-flow.js` - Creates deposit with 0 fee (works!)
- `extract-deposit-key.js` - Finds deposit key from EventEmitter logs
- `execute-with-key.js` - Attempts execution (fails)

### Key Code Snippets

**Creating Deposit (WORKS):**
```javascript
const depositParams = {
  addresses: {
    receiver: signer.address,
    callbackContract: ethers.constants.AddressZero,
    uiFeeReceiver: ethers.constants.AddressZero,
    market: MARKET,
    initialLongToken: USDT,
    initialShortToken: USDT,  // MUST be USDT, not AddressZero
    longTokenSwapPath: [],
    shortTokenSwapPath: []
  },
  minMarketTokens: 0,
  shouldUnwrapNativeToken: false,
  executionFee: 0,  // MUST be 0 to work!
  callbackGasLimit: 0,
  dataList: []
};
```

**Finding Deposit Key (WORKS):**
```javascript
// In EventEmitter logs, look for:
// topics[2] === keccak256("DepositCreated")
// Then deposit key is in topics[1]
```

## Next Steps to Try

1. **Debug Oracle Requirements**
   - Check if oracle prices need to be set at specific block
   - Verify timestamp requirements
   - Try different price formats

2. **Analyze Failed Execution Transaction**
   - Use Tenderly or local fork to debug exact revert
   - Check contract state at execution time

3. **Alternative Approaches**
   - Try executing with actual GMX keeper infrastructure
   - Check if there's a bootstrap/initialization needed for first deposit
   - Investigate if execution fee = 0 requires special handling

## Summary

**Progress**: We've gone from complete failure to successfully creating deposits. The key was understanding that `executionFee` must be 0 and both long/short tokens must be set to USDT.

**Current Block**: Deposit execution fails despite having correct roles, oracle prices, and deposit key. The exact cause needs further investigation.

**Impact**: 1066 USDT is currently stuck in DepositVault from our various attempts, but we now understand the deposit creation flow completely.