# Normal Deposit Process - Complete Guide

**Date**: September 2025
**Issue**: Adding liquidity to GMX V2 markets after the first deposit
**Solution**: Use normal deposit flow with user's address as receiver

## Executive Summary

After successfully executing the first deposit into a GMX V2 market (which requires `address(1)` as receiver), all subsequent deposits follow the normal deposit process. This guide documents the complete workflow for normal deposits, including the key differences from first deposits and all required configurations.

## Key Differences from First Deposit

| Aspect | First Deposit | Normal Deposit |
|--------|---------------|----------------|
| **Receiver Address** | `address(1)` | User's actual address |
| **Market Tokens** | Minted to `address(1)` | Minted to user directly |
| **minMarketTokens** | Must be 0 | Can be 0 or minimum expected |
| **Purpose** | Initialize market liquidity | Add liquidity for LP rewards |

## Prerequisites

Before executing normal deposits, ensure:

1. **First Deposit Completed**: Market must have initial liquidity (totalSupply > 0)
2. **Oracle Provider Configured**: Mock provider deployed and tokens mapped
3. **Token Balances**: Sufficient USDT and sNGN in user wallet
4. **ETH for Gas**: At least 0.01 ETH for execution fees

## The Complete Process

### Step 1: Verify Market Has Liquidity

Before attempting a normal deposit, confirm the market has been initialized:

```javascript
const marketToken = await ethers.getContractAt("MarketToken", MARKET);
const totalSupply = await marketToken.totalSupply();
console.log("Market Total Supply:", ethers.utils.formatEther(totalSupply));
// Should be > 0
```

### Step 2: Create Normal Deposit

**Script**: `claude/scripts/create-normal-deposit.js`

Key implementation details:

```javascript
// Deposit configuration
const usdtAmount = ethers.utils.parseUnits("100000", 6); // 100,000 USDT
const sngnAmount = ethers.utils.parseUnits("150000000", 18); // 150M sNGN
const executionFee = ethers.utils.parseEther("0.001");

// Critical: Use user's address as receiver
const depositParams = {
    addresses: {
        receiver: signer.address, // NOT address(1)
        callbackContract: ethers.constants.AddressZero,
        uiFeeReceiver: ethers.constants.AddressZero,
        market: MARKET,
        initialLongToken: USDT,
        initialShortToken: sNGN,
        longTokenSwapPath: [],
        shortTokenSwapPath: []
    },
    minMarketTokens: 0, // Can set minimum expected
    shouldUnwrapNativeToken: false,
    executionFee: executionFee,
    callbackGasLimit: 0,
    dataList: []
};
```

**Multicall Structure** (order matters):
1. `sendWnt` - Send execution fee (MUST be first)
2. `sendTokens` - Send USDT to DepositVault
3. `sendTokens` - Send sNGN to DepositVault
4. `createDeposit` - Create the deposit request

### Step 3: Execute Normal Deposit

**Script**: `claude/scripts/execute-normal-deposit.js`

Oracle parameters configuration:

```javascript
const oracleParams = {
    tokens: [USDT, sNGN],
    providers: [MOCK_PROVIDER, MOCK_PROVIDER],
    data: ["0x", "0x"] // Empty for mock provider
};

// Execute with proper gas buffer
const tx = await depositHandler.executeDeposit(depositKey, oracleParams, {
    gasLimit: estimatedGas.mul(120).div(100) // 20% buffer
});
```

### Step 4: Verify Success

After execution, verify:

1. **Transaction Status**: Should be SUCCESS (1)
2. **Market Tokens Received**: User balance should increase
3. **Total Supply Increased**: Market liquidity should grow

```javascript
const userBalance = await marketToken.balanceOf(signer.address);
console.log("Your Market Token Balance:", ethers.utils.formatEther(userBalance));
```

## Contract Addresses (Arbitrum Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| ExchangeRouter | `0x3B33708e9b8242999459EB9b4756C24c846e5936` | Entry point for deposits |
| DepositHandler | `0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00` | Executes deposits |
| DepositVault | `0x8672091de3AF3a02bE48cFB753810A736D9F6379` | Holds deposited tokens |
| DataStore | `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111` | Configuration storage |
| Router | `0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc` | Token transfer routing |
| USDT Market | `0x8E4C5f3296A100d4135187C3181258cb8a223bb1` | USDT/sNGN market |

## Token Configuration

| Token | Address | Decimals | Role |
|-------|---------|----------|------|
| USDT | `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6` | 6 | Long token |
| sNGN | `0xd66e60AA5b6982649a116e6944Daec22b15468Ad` | 18 | Short token |
| WETH | `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73` | 18 | Execution fee |

## Execution Commands

```bash
# Step 1: Ensure mock provider is deployed (one-time setup)
npx hardhat run claude/scripts/deploy-and-configure-mock-provider.js --network arbitrumSepolia

# Step 2: Set token providers (one-time setup)
npx hardhat run claude/scripts/set-token-providers.js --network arbitrumSepolia

# Step 3: Create normal deposit
npx hardhat run claude/scripts/create-normal-deposit.js --network arbitrumSepolia

# Step 4: Execute deposit
npx hardhat run claude/scripts/execute-normal-deposit.js --network arbitrumSepolia
```

## Common Issues and Solutions

### 1. InvalidReceiverForFirstDeposit Error
**Cause**: Trying to use user address when market has no liquidity
**Solution**: Complete first deposit with `address(1)` first

### 2. Insufficient Market Tokens Received
**Cause**: Price impact or fees
**Solution**: Check price impact settings and fee configuration

### 3. Deposit Timeout
**Cause**: Too much time between creation and execution
**Solution**: Execute deposits promptly after creation

### 4. Oracle Provider Errors
**Cause**: Provider not configured for tokens
**Solution**: Run `set-token-providers.js` script

## Successful Execution Example

From actual execution on September 2025:

**Deposit Creation:**
- Amount: 100,000 USDT + 150,000,000 sNGN
- TX: `0xd01e48e6f04226f1c380480f4b8f640e90d1b631394a6e7c31a0ccd9afa190cb`
- Deposit Key: `0xfff5391415050444b53b28ac5aa2d17a2b5831cc38941dc852d545dbabbd84cd`

**Deposit Execution:**
- TX: `0xdf5be050ee4c66a74681c79e214aa9fa50767f8a538fb2a2568bbec7ed5257dc`
- Market Tokens Received: 199,684.59
- Total Supply After: 201,682.75

## Key Learnings

1. **Receiver Address is Critical**: Normal deposits must use the actual user address, not `address(1)`
2. **Balanced Liquidity**: Maintain 1:1 USD value ratio between tokens for optimal pricing
3. **Oracle Provider Required**: Even for testnet, proper oracle configuration is essential
4. **Prompt Execution**: Execute deposits quickly to avoid timeout issues
5. **Gas Buffer**: Always include 20% gas buffer for execution

## Related Documentation

- **First Deposit Guide**: `claude/best_practices/first-deposit-solution-complete-guide.md`
- **Deposit Requirements**: `claude/best_practices/DEPOSIT_REQUIREMENTS.md`
- **Create/Execute Flow**: `claude/best_practices/create_execute_deposit_flow.md`

## Script Files Reference

| Script | Path | Purpose |
|--------|------|---------|
| Create Normal Deposit | `claude/scripts/create-normal-deposit.js` | Creates deposit with user as receiver |
| Execute Normal Deposit | `claude/scripts/execute-normal-deposit.js` | Executes deposit with oracle provider |
| Deploy Mock Provider | `claude/scripts/deploy-and-configure-mock-provider.js` | One-time oracle setup |
| Set Token Providers | `claude/scripts/set-token-providers.js` | Maps tokens to oracle provider |

## Conclusion

Normal deposits are straightforward once the market has been initialized with a first deposit. The key difference is using your actual address as the receiver instead of `address(1)`. This allows you to directly receive market tokens and participate as a liquidity provider, earning fees from trading activity in the market.

The scripts provided handle all the complexity of multicall construction, oracle parameter configuration, and proper gas estimation, making the process reliable and repeatable for adding liquidity to GMX V2 markets.