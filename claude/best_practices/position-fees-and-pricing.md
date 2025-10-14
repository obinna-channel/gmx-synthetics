# Position Fees and Pricing - Best Practices Guide

## Overview
This document explains how to retrieve real-time position data from GMX Reader contracts, provide accurate pricing, handle fees (borrowing and funding), and implement proper funding fee claiming mechanisms.

---

## 1. Position Data from Reader Contract

### What the Reader Returns

The `Reader.getAccountPositionInfoList()` function returns a `PositionInfo` struct containing:

```solidity
struct PositionInfo {
    bytes32 positionKey;                      // Unique position identifier
    Position.Props position;                  // Raw position data (size, collateral, etc.)
    PositionFees fees;                        // ⭐ ALL fee calculations (pre-computed)
    ExecutionPriceResult executionPriceResult; // Price impact information
    int256 basePnlUsd;                        // ⭐ Current PnL (capped by MAX_PNL_FACTOR_FOR_TRADERS)
    int256 uncappedBasePnlUsd;                // Uncapped PnL (for reference)
    int256 pnlAfterPriceImpactUsd;            // PnL including price impact
}
```

### Key Position Properties

```solidity
Position.Props {
    addresses: {
        account,           // Position owner
        market,            // Market address
        collateralToken    // Collateral token address
    },
    numbers: {
        sizeInUsd,         // Position size (30 decimals)
        sizeInTokens,      // Position size in tokens (18 decimals)
        collateralAmount,  // Collateral amount (token decimals, e.g., 6 for USDT)
        pendingImpactAmount,
        borrowingFactor,   // Cumulative borrowing factor at position open
        fundingFeeAmountPerSize,
        increasedAtTime,   // Timestamp position opened/increased
        decreasedAtTime
    },
    flags: {
        isLong            // true = long, false = short
    }
}
```

---

## 2. Providing Real-Time Prices to Reader

### ⚠️ Critical: Reader Requires Prices as Input

The Reader contract is a **pure view function** with NO oracle access. You MUST pass current prices, and it uses those prices to calculate PnL.

### How PnL is Calculated

```solidity
// In PositionUtils.sol:189
uint256 executionPrice = prices.indexTokenPrice.pickPriceForPnl(position.isLong(), false);

// Calculate position value with YOUR provided price
positionValue = sizeInTokens * executionPrice

// Calculate PnL
totalPnl = isLong
    ? (positionValue - sizeInUsd)      // Long: profit if price increased
    : (sizeInUsd - positionValue)      // Short: profit if price decreased
```

### ❌ Wrong Approach (Static Prices)

```javascript
// DON'T DO THIS - PnL will always use 1500!
const allMarketPrices = allMarkets.map(() => ({
  indexTokenPrice: {
    min: 1500000000000000000000000000000000n,  // Hardcoded!
    max: 1500000000000000000000000000000000n
  }
}));
```

### ✅ Correct Approach (Real-Time Prices)

```javascript
import { usePrice } from '../context/PriceContext';

export const usePositionReader = () => {
  const { prices } = usePrice(); // Get real-time prices from WebSocket

  // Helper: Convert price to GMX format (30 decimals)
  const priceToGmxFormat = (price) => {
    if (!price || price === 0) return 1500000000000000000000000000000000n;

    // GMX stores prices as: price * 10^30
    // Example: 1500.25 → 1500250000000000000000000000000000
    return BigInt(Math.floor(price * 1e30));
  };

  // Dynamic prices based on real-time WebSocket data
  const allMarketPrices = useMemo(() => {
    return allMarkets.map((market) => {
      // Map market address to pair (e.g., USDTNGN)
      const pairPrice = prices['USDTNGN']?.currentPrice || 1500;
      const formattedPrice = priceToGmxFormat(pairPrice);

      return {
        indexTokenPrice: { min: formattedPrice, max: formattedPrice },
        longTokenPrice: { min: formattedPrice, max: formattedPrice },
        shortTokenPrice: { min: formattedPrice, max: formattedPrice }
      };
    });
  }, [prices]); // ⭐ Recalculate when prices change

  // Pass dynamic prices to Reader
  const { data: rawPositions } = useReadContract({
    address: READER_ADDRESS,
    abi: Reader_ABI,
    functionName: 'getAccountPositionInfoList',
    args: [
      dataStore,
      referralStorage,
      walletAddress,
      allMarkets,
      allMarketPrices,  // ⭐ Real-time prices here!
      uiFeeReceiver,
      0n,
      1000n
    ],
    refetchInterval: 5000  // Poll every 5 seconds for fresh fees
  });
};
```

### Why Polling Matters

The `refetchInterval: 5000` ensures:
- ✅ Borrowing fees update in real-time (based on time elapsed)
- ✅ Funding fees update in real-time (based on long/short imbalance)
- ✅ PnL updates with current prices (if you pass updated prices!)

---

## 3. Fee Retrieval (Borrowing & Funding)

### The Reader Does ALL Calculations

The Reader contract calculates fees in **real-time** every time you call it:

```solidity
// ReaderPositionUtils.sol:231-233
// borrowing and funding fees need to be overwritten with pending values otherwise they
// would be using storage values that have not yet been updated
cache.pendingBorrowingFeeUsd = getNextBorrowingFees(dataStore, position, market, prices);
```

### PositionFees Struct

```solidity
struct PositionFees {
    PositionBorrowingFees borrowing;   // ⭐ Total accrued borrowing fee
    PositionFundingFees funding;       // ⭐ Total accrued funding fee
    uint256 positionFeeAmount;         // Open/close position fees
    uint256 totalCostAmount;           // ⭐ Sum of ALL fees
    // ... other fee types
}

struct PositionBorrowingFees {
    uint256 borrowingFeeUsd;          // Total borrowing fee in USD (30 decimals)
    uint256 borrowingFeeAmount;       // Total borrowing fee in collateral tokens
}

struct PositionFundingFees {
    uint256 fundingFeeAmount;         // Funding fee to PAY (if positive)
    uint256 claimableLongTokenAmount; // Claimable amount if funding is negative
    uint256 claimableShortTokenAmount;// Claimable amount if funding is negative
}
```

### Borrowing Fee Calculation

```solidity
// Formula:
pendingBorrowingFee = (currentBorrowingFactor - positionBorrowingFactor) * sizeInUsd

// Example:
// - Position opened when borrowingFactor = 10020%
// - Current borrowingFactor = 10025%
// - Position size = $10,000
// - Pending fee = (10025% - 10020%) * $10,000 = 0.05% * $10,000 = $5
```

### Funding Fee Calculation

```solidity
// Formula:
fundingFee = (latestFundingFeeAmountPerSize - positionFundingFeeAmountPerSize) * (sizeInUsd / precision)

// Direction:
// - If longs > shorts: Longs PAY, shorts RECEIVE
// - If shorts > longs: Shorts PAY, longs RECEIVE
```

### Frontend Extraction

```javascript
// From Reader response
const grossPnl = Number(basePnlUsd) / 1e30;                         // e.g., +$100
const borrowingFee = Number(fees.borrowing.borrowingFeeUsd) / 1e30; // e.g., $2
const fundingFee = Number(fees.funding.fundingFeeAmount) / 1e6;     // e.g., $3 or -$5

// Net PnL (what user actually gets)
const netPnl = grossPnl - borrowingFee - fundingFee;  // = $100 - $2 - $3 = $95

// OR if funding is negative (user receives)
const netPnl = grossPnl - borrowingFee + Math.abs(fundingFee);  // = $100 - $2 + $5 = $103
```

---

## 4. Funding Fee Payment Mechanics

### Positive Funding (User PAYS) ✅ Auto-Deducted

When you owe funding fees (e.g., you're long and longs are paying shorts):

```solidity
// DecreasePositionCollateralUtils.sol
// Automatically deducted from position collateral during ANY position update
payForCost(
    params,
    values,
    prices,
    collateralTokenPrice,
    fees.funding.fundingFeeAmount * collateralTokenPrice.min  // ⭐ AUTO-DEDUCTED
);
```

**When it's deducted:**
- ✅ When you increase position size
- ✅ When you decrease position size
- ✅ When you close position
- ✅ When position is liquidated

**Result:** Your `collateralAmount` is reduced by the funding fee amount.

### Negative Funding (User RECEIVES) ❌ NOT Auto-Added

When you EARN funding fees (e.g., you're short and longs are paying shorts):

```solidity
// PositionUtils.sol:566-592
function incrementClaimableFundingAmount(...) {
    // Stored as "claimable" in DataStore, NOT added to position collateral
    if (fees.funding.claimableLongTokenAmount > 0) {
        MarketUtils.incrementClaimableFundingAmount(
            dataStore,
            market,
            longToken,
            account,
            fees.funding.claimableLongTokenAmount  // ⭐ Stored separately
        );
    }
}
```

**What happens:**
- ❌ NOT added to your position's `collateralAmount`
- ✅ Stored in a separate `claimableBalance` in DataStore
- ⚠️ Requires manual claiming via `ExchangeRouter.claimFundingFees()`

**When it's stored:**
- ✅ During position increase
- ✅ During position decrease
- ✅ During position close

### Why This Design?

1. **Gas efficiency**: Claiming requires a transaction; GMX lets users batch claims
2. **Flexibility**: Users can claim from multiple markets/positions at once
3. **Security**: Prevents automatic transfers that could fail or be exploited

---

## 5. Claiming Negative Funding - Two Approaches

### Summary Table

| Scenario | Approach | User Action | Pros | Cons |
|----------|----------|-------------|------|------|
| **Open positions with claimable funding** | Manual Claim Button | Click "Claim Funding" | Can claim anytime | Requires separate transaction |
| **Closing position with claimable funding** | Auto-claim on Close | Click "Close Position" | Convenient, one transaction | Only works when closing |

---

### Approach 1: Manual Claim (For Open Positions)

Allow users to claim accumulated funding fees from open positions at any time.

#### Implementation

```javascript
// ExchangeRouter call
const claimAllFunding = async () => {
  const markets = [ARBITRUM_SEPOLIA_ADDRESSES.USDTNGN_MARKET];
  const tokens = [
    ARBITRUM_SEPOLIA_ADDRESSES.mUSD,
    ARBITRUM_SEPOLIA_ADDRESSES.mNGN
  ];

  try {
    const tx = await exchangeRouter.claimFundingFees(
      markets,    // Array of market addresses
      tokens,     // Array of token addresses (long + short)
      userAddress // Receiver address
    );

    await tx.wait();
    toast.success('Claimed funding fees!');
    refreshPositions();
  } catch (error) {
    console.error('Failed to claim funding:', error);
    toast.error('Failed to claim funding');
  }
};
```

#### UI Component Example

```javascript
const ClaimableFundingBanner = ({ positions }) => {
  // Calculate total claimable across all positions
  const totalClaimable = positions.reduce((sum, pos) => {
    const claimable =
      (pos.claimableLongTokenAmount || 0) +
      (pos.claimableShortTokenAmount || 0);
    return sum + (claimable / 1e6); // Convert from token decimals
  }, 0);

  const positionsWithClaimable = positions.filter(p =>
    (p.claimableLongTokenAmount > 0) || (p.claimableShortTokenAmount > 0)
  );

  if (totalClaimable === 0) return null;

  return (
    <div className="bg-green-900/20 border border-green-500 p-4 rounded-lg mb-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-green-500 font-medium text-lg">
            💰 ${totalClaimable.toFixed(2)} in claimable funding fees
          </p>
          <p className="text-gray-400 text-sm">
            From {positionsWithClaimable.length} open position{positionsWithClaimable.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={claimAllFunding}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
        >
          Claim Now
        </button>
      </div>
    </div>
  );
};
```

#### Per-Position Indicator

```javascript
const PositionRow = ({ position }) => {
  const hasClaimable =
    (position.claimableLongTokenAmount > 0) ||
    (position.claimableShortTokenAmount > 0);

  const claimableAmount =
    (position.claimableLongTokenAmount || 0) +
    (position.claimableShortTokenAmount || 0);

  return (
    <tr>
      {/* ... other columns ... */}

      {/* Funding Fee Column */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Show accrued funding */}
          <span className={position.accrued_funding > 0 ? 'text-red-500' : 'text-green-500'}>
            {position.accrued_funding > 0 ? '-' : '+'}
            ${Math.abs(position.accrued_funding).toFixed(2)}
          </span>

          {/* Show claim button if there's claimable funding */}
          {hasClaimable && (
            <button
              onClick={() => claimAllFunding()}
              className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded transition-colors"
              title="Claim accumulated funding fees"
            >
              Claim ${(claimableAmount / 1e6).toFixed(2)}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
```

---

### Approach 2: Auto-Claim on Position Close

Automatically claim funding fees when user closes a position using a multicall.

#### Implementation (Multicall)

```javascript
import { encodeFunctionData } from 'viem';

const closePositionWithAutoClaim = async (position) => {
  const markets = [position.market];
  const tokens = [
    ARBITRUM_SEPOLIA_ADDRESSES.mUSD,
    ARBITRUM_SEPOLIA_ADDRESSES.mNGN
  ];

  try {
    // Encode both function calls
    const calls = [
      {
        target: EXCHANGE_ROUTER_ADDRESS,
        allowFailure: false,
        callData: encodeFunctionData({
          abi: ExchangeRouter_ABI,
          functionName: 'createDecreaseOrder',
          args: [
            // ... decrease order parameters
          ]
        })
      },
      {
        target: EXCHANGE_ROUTER_ADDRESS,
        allowFailure: false,
        callData: encodeFunctionData({
          abi: ExchangeRouter_ABI,
          functionName: 'claimFundingFees',
          args: [markets, tokens, userAddress]
        })
      }
    ];

    // Execute both in one transaction
    const tx = await multicall({
      contracts: calls
    });

    await tx.wait();
    toast.success('Position closed and funding claimed!');
  } catch (error) {
    console.error('Failed to close position:', error);
    toast.error('Failed to close position');
  }
};
```

#### UI Button

```javascript
const ClosePositionButton = ({ position }) => {
  const hasClaimable =
    (position.claimableLongTokenAmount > 0) ||
    (position.claimableShortTokenAmount > 0);

  return (
    <button
      onClick={() => closePositionWithAutoClaim(position)}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
    >
      {hasClaimable ? 'Close & Claim' : 'Close Position'}
    </button>
  );
};
```

---

### Approach 2b: Sequential Calls (Fallback)

If multicall is not available or fails:

```javascript
const closePositionWithAutoClaim = async (position) => {
  try {
    // 1. Close the position first
    const closeTx = await closePosition(position.id);
    await closeTx.wait();

    // 2. Then claim funding
    const markets = [position.market];
    const tokens = [USDT_ADDRESS, NGN_ADDRESS];

    const claimTx = await exchangeRouter.claimFundingFees(
      markets,
      tokens,
      userAddress
    );
    await claimTx.wait();

    toast.success('Position closed and funding claimed!');
    refreshPositions();
  } catch (error) {
    console.error('Failed to close or claim:', error);
    toast.error('Failed to close position or claim funding');
  }
};
```

---

## 6. Complete UX Recommendations

### Show Claimable Funding Prominently

```javascript
// In TradingDashboard or Portfolio page
const FundingFeesSection = () => {
  const { positions } = usePosition();

  return (
    <div className="space-y-4">
      {/* Global banner for all claimable funding */}
      <ClaimableFundingBanner positions={positions} />

      {/* Position list with per-position claim buttons */}
      <PositionsList
        positions={positions}
        showClaimButtons={true}
      />
    </div>
  );
};
```

### User Education

Add tooltips/info icons explaining:
- ✅ "Positive funding fees are automatically deducted from your collateral"
- ✅ "Negative funding fees (earnings) accumulate and can be claimed anytime"
- ✅ "Claim all accumulated funding fees from multiple positions at once"

### Best Practice: Combine Both Approaches

1. **Manual claim button** for open positions (visible when claimable > $1)
2. **Auto-claim on close** for convenience (using multicall)
3. **Clear indicators** showing claimable amounts in real-time

---

## 7. Key Takeaways

✅ **Real-Time Pricing**: Always pass current prices to Reader contract for accurate PnL

✅ **Fee Calculations**: Reader does ALL calculations - no frontend math needed

✅ **Positive Funding**: Auto-deducted from collateral during position updates

❌ **Negative Funding**: Stored separately, requires manual claiming

✅ **UX Solution**: Provide both manual claim (for open positions) and auto-claim (on close)

✅ **Polling**: Use `refetchInterval: 5000` to keep fees updated in real-time

---

## 8. References

### Contract Files
- `contracts/position/Position.sol` - Position struct definition
- `contracts/reader/ReaderPositionUtils.sol` - Reader implementation
- `contracts/position/PositionUtils.sol` - PnL and fee calculations
- `contracts/market/MarketUtils.sol` - Funding state management
- `contracts/router/ExchangeRouter.sol` - User-facing functions

### Frontend Files
- `client/src/hooks/usePositionReader.js` - Position data fetching
- `client/src/context/PriceContext.js` - Real-time price management
- `client/src/components/trading/PositionsList.js` - Position display

---

**Last Updated**: October 2025
