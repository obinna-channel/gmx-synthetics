# Index Token Pricing Solution for Exchange Rate Markets

## Problem Statement

When building a synthetic exchange rate market (e.g., USD/NGN) in GMX V2, we encountered a critical issue with position P&L calculations when using a stablecoin as the index token.

### Initial Market Configuration (Market #7)
- **Index Token**: mUSD (6 decimals)
- **Long Token**: mUSD
- **Short Token**: mNGN (18 decimals)
- **Oracle Pricing**: mUSD = 1500 NGN, mNGN = 1 NGN

### The Issue

GMX interprets all oracle prices in USD terms, not in the local currency we intended. When we set:
- mUSD price to 1500 (intending 1500 NGN)
- GMX interpreted this as $1500 USD

This caused a 1500x discrepancy in position calculations:

```
Expected behavior (NGN-based):
- $100 position at 1500 NGN/USD = 150,000 NGN worth
- Price moves to 1600 NGN/USD
- P&L = 150,000 × (1600-1500)/1500 = 10,000 NGN ≈ $6.67

Actual behavior (USD interpretation):
- $100 position at "$1500" = 0.0667 mUSD tokens
- Price moves to "$1600"
- P&L = 0.0667 × ($1600-$1500) = $6.67 worth
- But GMX thinks mUSD is worth $1500, so actual P&L = $6.67/$1500 = $0.0044
```

The core problem: **SIZE_IN_TOKENS** was calculated incorrectly because GMX thought each mUSD was worth $1500 instead of $1.

## Solution: Virtual Index Token

We solved this by creating a virtual token specifically to track the exchange rate.

### New Market Configuration (Market #9)
- **Index Token**: mUSDTNGN (18 decimals) - A stub token with no supply
- **Long Token**: mUSD (6 decimals)
- **Short Token**: mNGN (18 decimals)

### Oracle Pricing (USD-based)
```javascript
EXCHANGE_RATE = 1500  // 1 USD = 1500 NGN

Prices:
- mUSDTNGN = 1500      // The exchange rate itself
- mUSD = 1 USD         // Standard USD stablecoin
- mNGN = 0.000666667 USD  // 1/1500
```

## Why This Works

1. **Index Token as Pure Rate**: mUSDTNGN represents the USDT/NGN exchange rate directly
   - Its price IS the exchange rate (1500)
   - No confusion about currency units

2. **Correct SIZE_IN_TOKENS**:
   ```
   $100 position / 1500 = 0.0667 mUSDTNGN tokens
   ```
   This represents "0.0667 units of the exchange rate"

3. **Proper P&L Calculation**:
   ```
   When rate moves from 1500 to 1600:
   P&L = 0.0667 × (1600 - 1500) = $6.67 ✓
   ```

## Implementation Steps

### 1. Deploy Virtual Index Token
```javascript
// Deploy a minimal ERC20 stub token
const Token = await ethers.getContractFactory("MintableToken");
const musdtngn = await Token.deploy("mUSDTNGN", "mUSDTNGN", 18);
// Note: Do NOT mint any supply - this is purely an index
```

### 2. Configure Oracle Prices
```javascript
// Single variable controls everything
const EXCHANGE_RATE = 1500;

// Set prices on MockOracleProvider
mockProvider.setPriceWithPrecision(mUSDTNGN, EXCHANGE_RATE * 10**12);  // 30-18=12
mockProvider.setPriceWithPrecision(mUSD, 1 * 10**24);                   // 30-6=24
mockProvider.setPriceWithPrecision(mNGN, (1/EXCHANGE_RATE) * 10**12);   // 30-18=12
```

### 3. Create Market
```javascript
{
  indexToken: mUSDTNGN,  // Virtual rate tracker
  longToken: mUSD,       // Collateral for longs
  shortToken: mNGN       // Collateral for shorts
}
```

### 4. Update Keeper/Oracle Services
```python
# Single variable to control pricing
EXCHANGE_RATE = 1500

PRICES = {
    mUSDTNGN: EXCHANGE_RATE * 10**12,
    mUSD: 1 * 10**24,
    mNGN: int((1 / EXCHANGE_RATE) * 10**12)
}
```

## Key Insights

1. **Index Token Purpose**: In GMX, the index token determines what is being traded. For exchange rates, this should be a token that represents the rate itself, not one of the currencies.

2. **Virtual Tokens are Valid**: The index token doesn't need to have any supply or be tradeable. It's just an identifier for price tracking.

3. **USD Denomination**: GMX fundamentally operates in USD terms. Work with this, not against it.

4. **Simplified Price Management**: With the exchange rate as a single variable, updating prices becomes trivial:
   - Change `EXCHANGE_RATE` from 1500 to 1600
   - Both mUSDTNGN and mNGN prices update automatically
   - mNGN becomes 1/1600 = 0.000625 USD

## Results

After implementing this solution:
- Position sizes are calculated correctly
- P&L matches expected values for exchange rate movements
- The market behaves like a proper forex pair
- Price updates are simple and consistent

### Example Position
```
Open: $100 long at 1500 NGN/USD
SIZE_IN_TOKENS: 0.0667 mUSDTNGN

Price moves to 1600 NGN/USD
P&L: 0.0667 × (1600-1500) = $6.67 ✓

Price moves to 1400 NGN/USD
P&L: 0.0667 × (1400-1500) = -$6.67 ✓
```

The virtual index token approach elegantly solves the pricing interpretation issue while maintaining compatibility with GMX's USD-based architecture.