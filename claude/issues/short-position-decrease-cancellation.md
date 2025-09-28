# Short Position Decrease Cancellation Issue

## Project Overview

Building an automated order keeper system for GMX Synthetics on Arbitrum Sepolia testnet. The keeper listens for order events and executes them automatically using a Python-based keeper (`order_keeper_v2.py`) deployed on Heroku.

## Market Configuration

### USDT/sNGN Perpetual Market

```javascript
{
  tokens: {
    indexToken: "USDT",  // Price represents USDT/NGN rate
    longToken: "USDT",   // Long collateral token
    shortToken: "sNGN",  // Short collateral token
  },

  // Virtual IDs for cross-market references
  virtualTokenIdForIndexToken: hashString("PERP:USDT/SNGN"),
  virtualMarketId: hashString("FX:USDT/SNGN"),

  // Position limits and pool configuration
  maxLongTokenPoolAmount: expandDecimals(500_000, 6),      // 500k USDT max pool
  maxShortTokenPoolAmount: expandDecimals(750_000_000, 18), // 750M sNGN max pool
  maxPoolUsdForDeposit: decimalToFloat(500_000),           // $500k max deposit

  // Open interest limits
  maxOpenInterest: decimalToFloat(250_000), // $250k max open interest per side

  // Position impact factors
  negativePositionImpactFactor: exponentToFloat("5e-9"),   // 0.0000005%
  positivePositionImpactFactor: exponentToFloat("2.5e-9"),  // 0.00000025%
  positionImpactExponentFactor: exponentToFloat("2e0"),    // Quadratic impact

  // Max position impact caps
  negativeMaxPositionImpactFactor: percentageToFloat("0.3%"),
  positiveMaxPositionImpactFactor: percentageToFloat("0.3%"),

  // Swap impact factors
  negativeSwapImpactFactor: exponentToFloat("1e-8"),
  positiveSwapImpactFactor: exponentToFloat("5e-9"),

  // Leverage configuration
  minCollateralFactor: percentageToFloat("2%"),                // 50x max leverage
  minCollateralFactorForLiquidation: percentageToFloat("1%"),  // Liquidation at 100x

  // Reserve factors
  reserveFactor: percentageToFloat("100%"),
  openInterestReserveFactor: percentageToFloat("95%"),

  // PnL factors
  maxPnlFactorForTraders: percentageToFloat("50%"),
  maxPnlFactorForDeposits: percentageToFloat("50%"),
  maxPnlFactorForWithdrawals: percentageToFloat("30%"),
}
```

### Contract Addresses (Arbitrum Sepolia)
```javascript
EXCHANGE_ROUTER: "0x3B33708e9b8242999459EB9b4756C24c846e5936"
ORDER_VAULT: "0xc58D48fc072641D3e1F70D884AFdFd804483dc6F"
DATA_STORE: "0xD70154A2e4BEF0485Bb6d90265a4F878A4556111"
MARKET: "0x8E4C5f3296A100d4135187C3181258cb8a223bb1"
USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6"
sNGN: "0xd66e60AA5b6982649a116e6944Daec22b15468Ad"
EVENT_EMITTER: "0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C"
MOCK_PROVIDER: "0x5D85d4acd35ffD0daD76C5eB0da3d7e53e20cCC5"
ORDER_HANDLER: "0x83f2d66af7f794893c31c0b32bd2d4ce826871d7"
```

### Current Market State
- USDT Pool: 100,974.60787 USDT
- sNGN Pool: 151,460,761.5 sNGN
- Short Open Interest: 110.0 USD

## Issue Description

### Summary
Short positions can be successfully created with USDT collateral but cannot be decreased or closed. The decrease order transaction succeeds but immediately emits an `OrderCancelled` event. **Long positions work perfectly - they can be opened, increased, decreased, and closed without any issues.**

### Current Position State
```
SHORT Position:
  Size: $110.0
  Collateral: 109.945 USDT
  Is Long: False
```

### Successful Operations
1. ✅ Opening LONG positions with USDT collateral
2. ✅ Increasing LONG positions
3. ✅ Decreasing LONG positions (partial and full)
4. ✅ Closing LONG positions entirely
5. ✅ Opening SHORT positions with USDT collateral
6. ✅ Increasing SHORT positions

### Failed Operations
1. ❌ Decreasing SHORT positions (partial)
2. ❌ Closing SHORT positions (full)

## Working Example: Long Position Decrease

Long positions decrease successfully with the following flow:
- Collateral Token: USDT
- PnL Token: USDT (same as collateral)
- No token mismatch, no swap needed
- Transaction completes successfully
- Position is properly decreased/closed

## Order Execution Details

### Order Creation Parameters
```javascript
// For SHORT decrease (50% of position)
{
  addresses: {
    receiver: "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292",
    cancellationReceiver: "0xBaB0D0892Bf8563B731f8e8970fE856ce9308292",
    callbackContract: "0x0000000000000000000000000000000000000000",
    uiFeeReceiver: "0x0000000000000000000000000000000000000000",
    market: "0x8E4C5f3296A100d4135187C3181258cb8a223bb1",
    initialCollateralToken: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6", // USDT
    swapPath: []
  },
  numbers: {
    sizeDeltaUsd: "55000000000000000000000000000000", // 55 USD
    initialCollateralDeltaAmount: "54972500", // 54.9725 USDT
    triggerPrice: 0,
    acceptablePrice: 0,
    executionFee: "1000000000000000", // 0.001 ETH
    callbackGasLimit: 0,
    minOutputAmount: 0,
    validFromTime: 0
  },
  orderType: 4, // MarketDecrease
  decreasePositionSwapType: 1, // SwapPnlTokenToCollateralToken
  isLong: false,
  shouldUnwrapNativeToken: false,
  autoCancel: false
}
```

### Keeper Execution Logs

#### Successful Execution
```
🚀 Executing Order (Attempt 1/3)
Order Key: 0xa9cf201cf5603a4fefd787a90be0c576a0b39a122bc4c284860a7bbe880c1171
Type: MarketDecrease

📊 Updating MockOracleProvider prices...
✅ USDT price updated: 1000000000000000000000000
✅ sNGN price updated: 666666666

📤 Transaction sent: 0xc9a81cc5af557fa72ddbd3628f0ee01f3f70af20339053bdf4887683330962fb
✅ Order executed successfully!
Block: 198421873
Gas used: 1761694
```

#### Immediate Cancellation
```
❌ ORDER CANCELLED EVENT
Order Key: 0xa9cf201cf5603a4fefd787a90be0c576a0b39a122bc4c284860a7bbe880c1171
Block: 198421873
TX: 0xc9a81cc5af557fa72ddbd3628f0ee01f3f70af20339053bdf4887683330962fb

📊 Cancellation Details:
Raw event data: 0x00000000000000000000000083f2d66af7f794893c31c0b32bd2d4ce826871d7...
Reason bytes: 0x00000000000000000000000083f2d66af7f794893c31c0b32bd2d4ce826871d7
```

The cancellation data points to the OrderHandler contract (`0x83f2d66af7f794893c31c0b32bd2d4ce826871d7`) as the source.

## Attempted Solutions

### 1. DecreasePositionSwapType Variations
- ✅ Set to `1` (SwapPnlTokenToCollateralToken) - Still cancelled
- ✅ Set to `0` (NoSwap) - Still cancelled

### 2. Transaction Analysis
- Transaction succeeds (no revert)
- Order execution event is emitted
- Cancellation event follows immediately in the same transaction

## Relevant Contract Code

### DecreasePositionUtils.sol - PnL Token Determination
```solidity
// Line 212-218
cache.pnlToken = params.position.isLong() ? params.market.longToken : params.market.shortToken;
cache.pnlTokenPrice = params.position.isLong() ? cache.prices.longTokenPrice : cache.prices.shortTokenPrice;

if (params.order.decreasePositionSwapType() != Order.DecreasePositionSwapType.NoSwap &&
    cache.pnlToken == params.position.collateralToken()) {
    params.order.setDecreasePositionSwapType(Order.DecreasePositionSwapType.NoSwap);
}
```

### DecreaseOrderUtils.sol - Two Token Output Handling
```solidity
// Lines 60-89
// if the pnlToken and the collateralToken are different
// and if a swap fails or no swap was requested
// then it is possible to receive two separate tokens from decreasing
// the position
if (result.secondaryOutputAmount > 0) {
    _validateOutputAmount(
        params.contracts.oracle,
        result.outputToken,
        result.outputAmount,
        result.secondaryOutputToken,
        result.secondaryOutputAmount,
        order.minOutputAmount()
    );

    MarketToken(payable(order.market())).transferOut(
        result.outputToken,
        order.receiver(),
        result.outputAmount,
        order.shouldUnwrapNativeToken()
    );

    MarketToken(payable(order.market())).transferOut(
        result.secondaryOutputToken,
        order.receiver(),
        result.secondaryOutputAmount,
        order.shouldUnwrapNativeToken()
    );
}
```

### DecreasePositionSwapUtils.sol - Swap Attempt
```solidity
// Lines 62-93
function swapProfitToCollateralToken(
    PositionUtils.UpdatePositionParams memory params,
    address pnlToken,
    uint256 profitAmount
) external returns (bool, uint256) {
    if (profitAmount > 0 && params.order.decreasePositionSwapType() == Order.DecreasePositionSwapType.SwapPnlTokenToCollateralToken) {
        Market.Props[] memory swapPathMarkets = new Market.Props[](1);
        swapPathMarkets[0] = params.market;

        try params.contracts.swapHandler.swap(
            // ... swap parameters
        ) returns (address /* tokenOut */, uint256 swapOutputAmount) {
            return (true, swapOutputAmount);
        } catch Error(string memory reason) {
            emit SwapUtils.SwapReverted(reason, "");
        } catch (bytes memory reasonBytes) {
            (string memory reason, /* bool hasRevertMessage */) = ErrorUtils.getRevertMessage(reasonBytes);
            emit SwapUtils.SwapReverted(reason, reasonBytes);
        }
    }
    return (false, 0);
}
```

## Key Observations

1. **Long positions work perfectly**: All operations (open, increase, decrease, close) function correctly for long positions
2. **Transaction Success**: The transaction completes successfully without reverting
3. **Event Sequence**: OrderExecuted event is followed immediately by OrderCancelled event
4. **Token Configuration**:
   - Long positions: Use USDT for both collateral and PnL (no mismatch)
   - Short positions: Use USDT for collateral but sNGN for PnL (token mismatch)
5. **Swap Configuration**: Both `NoSwap` and `SwapPnlTokenToCollateralToken` result in the same cancellation
6. **Position State**: The short position remains unchanged after the failed decrease attempt

## Additional Context

### Market Token Configuration
- Long positions: Use USDT for both collateral and PnL
- Short positions: Use USDT for collateral but sNGN for PnL calculations

### Oracle Configuration
Using MockOracleProvider with hardcoded prices:
- USDT: 1.00 USD
- sNGN: 1/1500 USD

### Testing Environment
- Network: Arbitrum Sepolia testnet
- Keeper: Python-based order_keeper_v2.py running on Heroku
- Test Script: test-market-orders.js using Hardhat

## Questions for Investigation

1. Why does the transaction succeed but emit a cancellation event?
2. Is there a post-execution validation that triggers the cancellation?
3. Are there specific requirements for handling short positions with collateral/PnL token mismatches?
4. Is this related to the MockOracleProvider or testnet-specific configuration?
5. Why do long positions work correctly but short positions fail on decrease?
6. Is the issue related to the swap mechanism between USDT and sNGN for short positions?

## Related Files

- `/scripts/test-market-orders.js` - Testing script for market orders
- `/keeper/order_keeper_v2.py` - Order execution keeper
- `/contracts/order/DecreaseOrderUtils.sol` - Decrease order logic
- `/contracts/position/DecreasePositionUtils.sol` - Position decrease logic
- `/contracts/position/DecreasePositionSwapUtils.sol` - Swap handling for decreases
- `/claude/plans/order-keeper-implementation-plan.md` - Implementation plan and progress