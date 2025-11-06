# Market Deployment Best Practices Guide

## Overview
This guide provides a comprehensive, step-by-step process for deploying new markets (both stock and crypto/stablecoin markets) in the Marks protocol. It is based on lessons learned from the TSLA market deployment.

---

## Table of Contents
1. [Pre-Deployment Preparation](#phase-1-pre-deployment-preparation)
2. [Deploy Market Index Token](#phase-2-deploy-market-index-token)
3. [Configure Oracle Provider](#phase-3-configure-oracle-provider)
4. [Update Configuration Files](#phase-4-update-configuration-files)
5. [Deploy Market](#phase-5-deploy-market)
6. [Initialize Market & Add Liquidity](#phase-6-initialize-market--add-liquidity)
7. [Update Keeper](#phase-7-update-keeper)
8. [Test Market](#phase-8-test-market)
9. [Update Frontend](#phase-9-update-frontend)
10. [Documentation & Validation](#phase-10-documentation--validation)

---

## Phase 1: Pre-Deployment Preparation

### Step 1: Decide on Market Parameters

**Key Decisions:**
- **Index Token**: What asset to track (e.g., TSLA stock, USDTNGN exchange rate)
- **Long Token**: Collateral for long positions (e.g., USDT, mUSD)
- **Short Token**: Collateral for short positions (e.g., USDT, mUSD, mNGN)
- **Market Type**: Single-token (long = short) or dual-token (long ≠ short)

**Examples:**
```
Stock Market (TSLA):
  - Index: mTSLA (tracks TSLA stock price)
  - Long: mUSD
  - Short: mUSD (single-token market)

Stablecoin/FX Market (USDTNGN):
  - Index: mUSDTNGN (tracks USDT/NGN exchange rate)
  - Long: mUSD
  - Short: mNGN (dual-token market)
```

---

## Phase 2: Deploy Market Index Token

### Step 2: Deploy the Index Token Contract

**Script Template**: `scripts/deploy-mtsla-token.js`

**Process:**
1. Use the `MintableToken` contract factory
2. Set token parameters:
   - Name: e.g., "mTSLA"
   - Symbol: e.g., "mTSLA"
   - Decimals: **18** (standard for precision)
3. Deploy the contract

**Important Notes:**
- ⚠️ **NO minting needed** - this is just an index/stub token for price tracking
- Save the deployment address immediately
- Save deployment info to JSON file for reference

**Example Deployment:**
```javascript
const Token = await ethers.getContractFactory("MintableToken");
const mtsla = await Token.deploy("mTSLA", "mTSLA", 18);
await mtsla.deployed();
console.log("mTSLA deployed to:", mtsla.address);
```

**Command:**
```bash
npx hardhat run scripts/deploy-YOUR-TOKEN.js --network arbitrumSepolia
```

---

## Phase 3: Configure Oracle Provider

### Step 3: Set Up Oracle Provider for the Index Token

**Script Template**: `claude/scripts/set-mtsla-provider.js`

**Process:**
1. Get contract instances:
   - DataStore
   - Oracle
   - MockOracleProvider (testnet) or real provider (mainnet)
2. Calculate the oracle provider key:
   ```javascript
   const ORACLE_PROVIDER_FOR_TOKEN = ethers.utils.keccak256(
       ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"])
   );
   const providerKey = ethers.utils.keccak256(
       ethers.utils.defaultAbiCoder.encode(
           ["bytes32", "address", "address"],
           [ORACLE_PROVIDER_FOR_TOKEN, ORACLE, INDEX_TOKEN]
       )
   );
   ```
3. Set the provider in DataStore:
   ```javascript
   await dataStore.setAddress(providerKey, MOCK_PROVIDER);
   ```
4. Verify provider is set correctly

**Command:**
```bash
npx hardhat run claude/scripts/set-YOUR-TOKEN-provider.js --network arbitrumSepolia
```

---

### Step 4: Set Initial Price for Index Token

**Script Template**: `claude/scripts/set-mtsla-price.js`

**Price Precision Formula:**
```
price_with_30_decimals = actual_price * 10^(30 - token_decimals)
```

**Examples:**
```javascript
// TSLA at $428 (token has 18 decimals):
const price = 428 * 10^(30-18) = 428 * 10^12

// USDTNGN at 1,650 NGN per USDT (token has 18 decimals):
const price = 1650 * 10^(30-18) = 1650 * 10^12
```

**Process:**
```javascript
const mockProvider = await ethers.getContractAt(mockProviderAbi, MOCK_PROVIDER);
const price30Decimals = ethers.BigNumber.from(PRICE).mul(ethers.BigNumber.from(10).pow(12));
await mockProvider.setPriceWithPrecision(INDEX_TOKEN, price30Decimals);
```

**Command:**
```bash
npx hardhat run claude/scripts/set-YOUR-TOKEN-price.js --network arbitrumSepolia
```

---

## Phase 4: Update Configuration Files

### Step 5: Add Token to `config/tokens.ts`

**Location**: `config/tokens.ts` (around line 1416, in the `arbitrumSepolia` section)

**Format:**
```typescript
YOUR_TOKEN: {
  address: "0xYourDeployedTokenAddress",
  decimals: 18,
  transferGasLimit: 200 * 1000,
  dataStreamFeedId: "0x0000000000000000000000000000000000000000000000000000000000000000",
  dataStreamFeedDecimals: 18,
}
```

**Example (mTSLA):**
```typescript
mTSLA: {
  address: "0x77d4DdD2E847592fb7710e342C0492A4b85655f4",
  decimals: 18,
  transferGasLimit: 200 * 1000,
  dataStreamFeedId: "0x0000000000000000000000000000000000000000000000000000000000000000",
  dataStreamFeedDecimals: 18,
}
```

---

### Step 6: Add Market Configuration to `config/markets.ts`

**Location**: `config/markets.ts` - Add new market object to the markets array

**Required Configuration:**

```typescript
{
  tokens: {
    indexToken: "YOUR_INDEX_TOKEN",  // e.g., "mTSLA"
    longToken: "YOUR_LONG_TOKEN",    // e.g., "mUSD"
    shortToken: "YOUR_SHORT_TOKEN",  // e.g., "mUSD" or "mNGN"
  },

  // Virtual IDs for cross-market tracking
  virtualTokenIdForIndexToken: hashString("PERP:YOUR_PAIR"),  // e.g., "PERP:TSLA/USD"
  virtualMarketId: hashString("TYPE:YOUR_PAIR"),              // e.g., "STOCK:TSLA/USD" or "CRYPTO:USDTNGN"

  // Base configuration
  ...singleTokenMarketConfig,  // or ...baseMarketConfig for dual-token

  // All required market parameters (see existing markets for examples)
  // - maxLongTokenPoolAmount
  // - maxShortTokenPoolAmount
  // - maxOpenInterestForLongs
  // - maxOpenInterestForShorts
  // - negativePositionImpactFactor
  // - positivePositionImpactFactor
  // - negativeSwapImpactFactor (0 for single-token markets)
  // - positiveSwapImpactFactor
  // - borrowing factors
  // - funding factors
  // - etc.
}
```

**Example (TSLA Stock Market):**
```typescript
{
  tokens: {
    indexToken: "mTSLA",
    longToken: "mUSD",
    shortToken: "mUSD",
  },

  virtualTokenIdForIndexToken: hashString("PERP:TSLA/USD"),
  virtualMarketId: hashString("STOCK:TSLA/USD"),

  ...singleTokenMarketConfig,

  // Custom parameters for TSLA market
  maxLongTokenPoolAmount: expandDecimals(10_000_000, 6),
  maxShortTokenPoolAmount: expandDecimals(10_000_000, 6),
  // ... (see line 4863 in markets.ts for full TSLA config)
}
```

**Reference**: See TSLA config at `config/markets.ts:4863`

---

### Step 7: Add Perp Config to `scripts/validateMarketConfigsUtils.ts`

**Location**: `scripts/validateMarketConfigsUtils.ts` - Add to the network-specific section (e.g., `arbitrumSepolia` around line 667)

**Format:**
```typescript
"INDEX_TOKEN:LONG_TOKEN:SHORT_TOKEN": {
  negativePositionImpactFactor: exponentToFloat("2e-9"),
  negativeSwapImpactFactor: 0,  // 0 for single-token markets, or set value for dual-token
  expectedSwapImpactRatio: 10_000,
  expectedPositionImpactRatio: 20_000,
}
```

**Example (TSLA):**
```typescript
"mTSLA:mUSD:mUSD": {
  negativePositionImpactFactor: exponentToFloat("2e-9"),
  negativeSwapImpactFactor: 0, // single token market
  expectedSwapImpactRatio: 10_000,
  expectedPositionImpactRatio: 20_000,
}
```

**Notes:**
- For **single-token markets**: `negativeSwapImpactFactor: 0`
- For **dual-token markets**: Set appropriate swap impact factor
- Impact factors control price slippage based on trade size
- Lower values = more slippage protection (safer but less capital efficient)

**Reference**: See TSLA config at `scripts/validateMarketConfigsUtils.ts:667`

---

## Phase 5: Deploy Market

### Step 8: Deploy the Market Using Hardhat

**Command:**
```bash
npx hardhat deploy --network arbitrumSepolia --tags Markets
```

**What Happens:**
1. Runs `deploy/deployAndConfigureMarkets.ts`
2. Calls `MarketFactory.createMarket(indexToken, longToken, shortToken, marketType)`
3. Sets virtual IDs for tracking
4. Configures market parameters from `markets.ts`
5. Returns market token address

**Verification:**
- Check deployment output for market address
- Verify market appears in on-chain markets list
- Save market address for next steps

**Important Files:**
- `deploy/deployAndConfigureMarkets.ts:40` - Market creation logic
- `deploy/deployMarketFactory.ts` - MarketFactory deployment

---

## Phase 6: Initialize Market & Add Liquidity

### Step 9: Create and Execute FIRST Deposit (Market Initialization)

**Script Template**: `claude/scripts/create-deposit-tsla-market.js`

**Purpose**: Initialize the market (NOT add meaningful liquidity)

**Critical Parameters:**
- ⚠️ **Receiver**: MUST be `address(1)` = `0x0000000000000000000000000000000000000001`
- ⚠️ **minMarketTokens**: MUST be `0`
- **Amount**: Small amount (e.g., 1,000 mUSD)

**Process:**
1. Approve tokens to Router (NOT ExchangeRouter!)
2. Clear deposit vault if needed:
   ```javascript
   const vaultBalance = await token.balanceOf(DEPOSIT_VAULT);
   if (vaultBalance.gt(0)) {
     await depositVault["transferOut(address,address,uint256,bool)"](
       TOKEN, signer.address, vaultBalance, false
     );
     await depositVault.syncTokenBalance(TOKEN);
   }
   ```
3. Build multicall:
   - `sendWnt` - Send execution fee (MUST be first)
   - `sendTokens` - Send collateral token(s)
   - `createDeposit` - Create deposit with params
4. Execute multicall
5. Save deposit key from event logs

**Deposit Parameters:**
```javascript
const depositParams = {
  addresses: {
    receiver: "0x0000000000000000000000000000000000000001", // address(1) for first deposit
    callbackContract: ethers.constants.AddressZero,
    uiFeeReceiver: ethers.constants.AddressZero,
    market: MARKET_ADDRESS,
    initialLongToken: LONG_TOKEN,
    initialShortToken: SHORT_TOKEN,
    longTokenSwapPath: [],
    shortTokenSwapPath: []
  },
  minMarketTokens: 0, // MUST be 0 for first deposit
  shouldUnwrapNativeToken: false,
  executionFee: executionFee,
  callbackGasLimit: 0,
  dataList: []
};
```

**Execute Deposit:**
- Script: `claude/scripts/execute-deposit-tsla-market.js`
- Use keeper or manual execution via `DepositHandler.executeDeposit()`
- Verify deposit completes successfully

**Commands:**
```bash
# Create first deposit
npx hardhat run claude/scripts/create-deposit-YOUR-MARKET.js --network arbitrumSepolia

# Execute first deposit
npx hardhat run claude/scripts/execute-deposit-YOUR-MARKET.js --network arbitrumSepolia
```

**Reference**: `claude/scripts/create-deposit-tsla-market.js`

---

### Step 10: Add Meaningful Liquidity (Second Deposit)

**Script Template**: `claude/scripts/create-deposit-tsla-200k.js`

**Purpose**: Add actual trading liquidity to the market

**Parameters (Different from First Deposit):**
- ✅ **Receiver**: YOUR wallet address (not address(1))
- ✅ **minMarketTokens**: Can be > 0 for slippage protection
- **Amount**: Larger amount (e.g., 200,000 mUSD)

**Process:**
1. Same approval and multicall process as first deposit
2. Use your address as receiver
3. Set appropriate minMarketTokens for slippage protection
4. Execute deposit
5. Verify market has sufficient liquidity

**Example:**
```javascript
const depositParams = {
  addresses: {
    receiver: signer.address, // YOUR address now
    // ... other params same as first deposit
  },
  minMarketTokens: ethers.utils.parseUnits("190000", 18), // Slippage protection
  // ... rest same
};
```

**Commands:**
```bash
# Create liquidity deposit
npx hardhat run claude/scripts/create-deposit-YOUR-MARKET-200k.js --network arbitrumSepolia

# Execute liquidity deposit
npx hardhat run claude/scripts/execute-deposit-YOUR-MARKET.js --network arbitrumSepolia
```

**Reference**: `claude/scripts/create-deposit-tsla-200k.js`

---

## Phase 7: Update Keeper

### Step 11: Update Keeper Configuration

**File**: `keeper/order_keeper_v2.py`

This section applies to **BOTH stock markets AND crypto/stablecoin markets**.

---

#### A. Add Token Address Constants (~line 821)

```python
# Stock market example:
self.mTSLA = "0x77d4DdD2E847592fb7710e342C0492A4b85655f4"

# Crypto/stablecoin market example:
self.mUSDTNGN = "0x168e829F546940AE7Ab336aF4Bd95d07f7f6cE73"

# Your new token:
self.YOUR_TOKEN = "0xYourTokenAddress"
```

---

#### B. Add Market Address Constants (~line 826)

```python
# Stock market example:
self.mTSLA_MARKET = "0x8ae559448a1482faffC925eF6a233276588348Df"

# Crypto/stablecoin market example:
self.mUSDTNGN_MARKET = "0x5E63276Caae0FF49b2762b98A1d37941AA50F804"

# Your new market:
self.YOUR_MARKET = "0xYourMarketAddress"
```

---

#### C. Add Market to MARKETS Dictionary (~line 858)

**For STOCK Markets:**
```python
self.mTSLA_MARKET: {
    "name": "TSLA",
    "indexToken": self.mTSLA,
    "longToken": self.mUSD,
    "shortToken": self.mUSD,
    "pricePair": "TSLA",      # Matches stock ticker
    "type": "stock"           # Important: type = "stock"
}
```

**For CRYPTO/Stablecoin Markets:**
```python
self.mUSDTNGN_MARKET: {
    "name": "USDTNGN",
    "indexToken": self.mUSDTNGN,
    "longToken": self.mUSD,
    "shortToken": self.mNGN,
    "pricePair": "USDTNGN",   # Matches crypto pair
    "type": "crypto"          # Important: type = "crypto"
}
```

---

#### D. Add Ticker to Appropriate Price Feed (~line 885)

**For STOCK Markets** - Add to `stock_tickers`:
```python
stock_tickers = ["TSLA", "AAPL", "NVDA", "META", "YOUR_STOCK"]
```

**For CRYPTO/Stablecoin Markets** - No changes needed:
```python
# Already handled by crypto feed
# No additional ticker configuration required
```

---

#### E. Price Precision Handling (`get_market_prices()` ~line 1260)

The keeper handles different market types automatically:

**Stock Markets:**
```python
elif market_config["type"] == "stock":
    stock_price = current_price
    prices = {
        market_config["indexToken"]: int(stock_price * 10**12),  # Index token (18 decimals)
        market_config["longToken"]: 1 * 10**24,                  # mUSD = $1 (6 decimals)
        market_config["shortToken"]: 1 * 10**24,                 # mUSD = $1 (6 decimals)
    }
```

**Crypto Markets:**
```python
elif market_config["type"] == "crypto":
    crypto_price = current_price
    prices = {
        market_config["indexToken"]: int(crypto_price * 10**12), # Index token (18 decimals)
        market_config["longToken"]: 1 * 10**24,                  # mUSD = $1 (6 decimals)
        market_config["shortToken"]: ngn_price_30_decimals,      # mNGN (varies)
    }
```

**Note**: Precision formula is `price * 10^(30 - token_decimals)`

---

#### F. Add to Token Name Mapping (~line 1676)

```python
token_name = 'mUSD' if token_address.lower() == self.mUSD.lower() else \
             'mNGN' if token_address.lower() == self.mNGN.lower() else \
             'mUSDTNGN' if token_address.lower() == self.mUSDTNGN.lower() else \
             'mTSLA' if token_address.lower() == self.mTSLA.lower() else \
             'YOUR_TOKEN' if token_address.lower() == self.YOUR_TOKEN.lower() else \
             'Unknown'
```

---

### Key Differences Between Market Types in Keeper

| Aspect | Stock Market | Crypto/Stablecoin Market |
|--------|--------------|--------------------------|
| **type** | `"stock"` | `"crypto"` |
| **pricePair** | Stock ticker (e.g., "TSLA") | Crypto pair (e.g., "USDTNGN") |
| **Price Feed** | Stock feed (marks-server stocks endpoint) | Crypto feed (marks-server crypto endpoint) |
| **Ticker List** | Add to `stock_tickers` | Already in crypto feed |
| **Market Hours** | Respects US stock market hours | 24/7 trading |
| **Price Source** | Stock API via marks-server | Crypto API via marks-server |
| **Order Execution** | Only during market hours | Anytime |

---

## Phase 8: Test Market

### Step 12: Test Long Position

**Script Template**: `claude/scripts/create-test-order-tsla.js`

**Process:**
1. Set order parameters:
   ```javascript
   const collateralAmount = ethers.utils.parseUnits("100", 6); // 100 mUSD
   const sizeDeltaUsd = ethers.utils.parseUnits("1000", 30);   // $1,000 position (10x leverage)
   ```
2. Approve collateral token to Router
3. Build multicall:
   - `sendWnt` - Execution fee
   - `sendTokens` - Collateral
   - `createOrder` - Market increase order
4. Set order parameters:
   ```javascript
   orderType: 2,  // MarketIncrease
   isLong: true,  // Long position
   acceptablePrice: ethers.utils.parseUnits("1000", 12), // Max price
   ```
5. Execute and save order key
6. Verify keeper executes the order
7. Check position is created correctly

**Command:**
```bash
npx hardhat run claude/scripts/create-test-order-YOUR-MARKET.js --network arbitrumSepolia
```

**Reference**: `claude/scripts/create-test-order-tsla.js`

---

### Step 13: Test Short Position

**Script Template**: `claude/scripts/create-test-order-tsla-short.js`

**Process:**
1. Same as long position test
2. Change: `isLong: false`
3. Verify keeper executes the order
4. Check short position is created correctly

**Command:**
```bash
npx hardhat run claude/scripts/create-test-order-YOUR-MARKET-short.js --network arbitrumSepolia
```

**Reference**: `claude/scripts/create-test-order-tsla-short.js`

---

### Step 14: Test Closing Positions

**Scripts:**
- `claude/scripts/close-tsla-position.js` (close long)
- `claude/scripts/close-tsla-short-position.js` (close short)

**Process:**
1. Create decrease order (MarketDecrease)
2. Set `sizeDeltaUsd` to position size (or partial)
3. Execute and verify position closes
4. Check PnL calculations are correct

**Commands:**
```bash
# Close long position
npx hardhat run claude/scripts/close-YOUR-MARKET-position.js --network arbitrumSepolia

# Close short position
npx hardhat run claude/scripts/close-YOUR-MARKET-short-position.js --network arbitrumSepolia
```

**Reference**:
- `claude/scripts/close-tsla-position.js`
- `claude/scripts/close-tsla-short-position.js`

---

## Phase 9: Update Frontend

### Step 15: Add Market to Frontend Configuration

**Purpose**: Enable the frontend to display positions, create orders, and show market information for the new market.

---

#### A. Update Contract Addresses (`client/src/contracts/addresses.js`)

**Add Index Token Address** (~line 55):
```javascript
// Stock Index Tokens (Oct 2025)
mTSLA: '0x77d4DdD2E847592fb7710e342C0492A4b85655f4', // 18 decimals - TSLA stock index
YOUR_TOKEN: '0xYourTokenAddress', // 18 decimals - YOUR_TOKEN description

// Currency Index Tokens (Oct 2025)
mUSDTARS: '0xed6890bE2409F0db06a00C809a298E2E06553BE1', // 18 decimals - USDT/ARS exchange rate index
```

**Add Token Decimals** (~line 78):
```javascript
const TOKEN_DECIMALS = {
  [ARBITRUM_SEPOLIA_ADDRESSES.mUSD]: 6,
  [ARBITRUM_SEPOLIA_ADDRESSES.mNGN]: 18,
  [ARBITRUM_SEPOLIA_ADDRESSES.mUSDTNGN]: 18,
  [ARBITRUM_SEPOLIA_ADDRESSES.mTSLA]: 18,
  [ARBITRUM_SEPOLIA_ADDRESSES.mUSDTARS]: 18,
  [ARBITRUM_SEPOLIA_ADDRESSES.YOUR_TOKEN]: 18,
};
```

**Add Market Configuration** (~line 87):
```javascript
const MARKETS = {
  // ... existing markets
  YOUR_MARKET: {
    marketToken: '0xYourMarketTokenAddress', // Market X: YOUR_INDEX [LONG-SHORT]
    indexToken: ARBITRUM_SEPOLIA_ADDRESSES.YOUR_TOKEN,
    longToken: ARBITRUM_SEPOLIA_ADDRESSES.LONG_TOKEN,
    shortToken: ARBITRUM_SEPOLIA_ADDRESSES.SHORT_TOKEN,
    symbol: 'YOUR_SYMBOL',
    description: 'Market X: YOUR_INDEX [LONG-SHORT] for trading YOUR_ASSET',
  },
};
```

**Example (NVDA):**
```javascript
// Stock Index Tokens (Oct 2025)
mNVDA: '0xbF159fd6ff7C70EC9A6cC15d31EfF2ae2E82B325', // 18 decimals - NVDA stock index

// Token Decimals
const TOKEN_DECIMALS = {
  // ...
  [ARBITRUM_SEPOLIA_ADDRESSES.mNVDA]: 18,
};

// Markets
NVDA: {
  marketToken: '0x2c8b9691C1cDF99AAeBD304df9Db54f79b45423C', // Market 13: mNVDA [mUSD-mUSD]
  indexToken: ARBITRUM_SEPOLIA_ADDRESSES.mNVDA,
  longToken: ARBITRUM_SEPOLIA_ADDRESSES.mUSD,
  shortToken: ARBITRUM_SEPOLIA_ADDRESSES.mUSD,
  symbol: 'NVDA',
  description: 'Market 13: mNVDA [mUSD-mUSD] for trading NVIDIA stock',
},
```

**Reference**: `client/src/contracts/addresses.js`

---

#### B. Update Position Reader (`client/src/hooks/usePositionReader.js`)

**Add to allMarkets Array** (~line 26):
```javascript
const allMarkets = [
  MARKETS.USDTNGN.marketToken, // USDTNGN market
  MARKETS.TSLA.marketToken, // TSLA market (Market 11)
  MARKETS.USDTARS.marketToken, // USDTARS market (Market 12)
  MARKETS.YOUR_MARKET.marketToken, // YOUR_MARKET market (Market X)
];
```

**Add to MARKET_PAIR_MAP** (~line 33):
```javascript
const MARKET_PAIR_MAP = useMemo(() => {
  const map = {
    [MARKETS.USDTNGN.marketToken.toLowerCase()]: 'USDTNGN',
    [MARKETS.TSLA.marketToken.toLowerCase()]: 'TSLA',
    [MARKETS.USDTARS.marketToken.toLowerCase()]: 'USDTARS',
    [MARKETS.YOUR_MARKET.marketToken.toLowerCase()]: 'YOUR_SYMBOL',
  };
  // ...
}, []);
```

**Add Token Decimals** (~line 146):
```javascript
const TOKEN_DECIMALS = useMemo(() => {
  const decimals = {};
  decimals[ARBITRUM_SEPOLIA_ADDRESSES.mUSD.toLowerCase()] = 6;
  decimals[ARBITRUM_SEPOLIA_ADDRESSES.mNGN.toLowerCase()] = 18;
  decimals[ARBITRUM_SEPOLIA_ADDRESSES.mUSDTARS.toLowerCase()] = 18;
  decimals[ARBITRUM_SEPOLIA_ADDRESSES.mTSLA.toLowerCase()] = 18;
  decimals[ARBITRUM_SEPOLIA_ADDRESSES.YOUR_TOKEN.toLowerCase()] = 18;
  return decimals;
}, []);
```

**Reference**: `client/src/hooks/usePositionReader.js`

---

#### C. Update Position Context (`client/src/context/PositionContext.js`)

**Add Market Address Mapping** (~line 111):
```javascript
const marketMap = {
  '0x5e63276caae0ff49b2762b98a1d37941aa50f804': 'USDTNGN', // Market 9
  '0xb1faf4afd5bd6aa53cf056bba31cca1c44234a24': 'USDTNGN', // Market 2
  '0x8ae559448a1482faffc925ef6a233276588348df': 'TSLA', // Market 11
  '0xa97a12dcffb8ab49bda3198b0d9fd0a3563c4d69': 'USDTARS', // Market 12
  '0xyourmarketaddressinlowercase': 'YOUR_SYMBOL', // Market X
};
```

**Important**: Market addresses must be in **lowercase** for the mapping to work correctly.

**Reference**: `client/src/context/PositionContext.js`

---

#### D. Verify Trading Pairs Configuration (`client/src/config/tradingPairs.js`)

Check if your market symbol already exists in `TRADING_PAIRS` array (~line 8).

**For Stock Markets:**
```javascript
{
  symbol: 'YOUR_SYMBOL',
  name: 'Company Name Inc.',
  flag: '📈', // Fallback emoji
  logo: 'https://logo.clearbit.com/yourcompany.com',
  category: 'stocks',
  isStock: true,
},
```

**For Crypto/Stablecoin Markets:**
```javascript
{
  symbol: 'YOUR_SYMBOL',
  name: 'Currency Name',
  flag: '🇨🇴', // Country flag emoji
  category: 'stablecoins',
  isStock: false,
},
```

**If Not Present**: Add the configuration to the `TRADING_PAIRS` array.

**Reference**: `client/src/config/tradingPairs.js`

---

### Frontend Integration Summary

After completing these steps, the frontend will:

✅ **Display Positions**: Your market's positions will show in the positions table
✅ **Show Market Icons**:
  - Stock markets: Display company logo from clearbit
  - Currency markets: Display country flag emoji
✅ **Enable Order Creation**: OrderForm will use correct market-specific configuration
✅ **Calculate Position Sizes**: Uses correct market-specific fees for accurate estimates
✅ **Show History**: Closed positions display with proper market identification
✅ **Support Multiple Markets**: All markets (USDTNGN, TSLA, USDTARS, YOUR_MARKET, etc.) work simultaneously

---

## Phase 10: Documentation & Validation

### Step 16: Update Deployment Documentation

**File**: `claude/deployments/marks-arbitrumSepolia-deployments.md`

**Add Custom Token to Table** (~line 21):
```markdown
| YOUR_TOKEN | YOUR_SYMBOL | `0xYourTokenAddress` | 18 | [View on Explorer](https://sepolia.arbiscan.io/address/0xYourTokenAddress) |
```

**Add Market to Markets Table** (~line 36):
```markdown
| Market X: YOUR_INDEX [LONG-SHORT] | YOUR_INDEX | LONG_TOKEN | SHORT_TOKEN | `0xYourMarketAddress` | [View on Explorer](https://sepolia.arbiscan.io/address/0xYourMarketAddress) |
```

**Example (TSLA):**
```markdown
| TSLA Stock Index | mTSLA | `0x77d4DdD2E847592fb7710e342C0492A4b85655f4` | 18 | [View on Explorer](https://sepolia.arbiscan.io/address/0x77d4DdD2E847592fb7710e342C0492A4b85655f4) |

| Market 11: mTSLA [mUSD-mUSD] | mTSLA | mUSD | mUSD | `0x8ae559448a1482faffC925eF6a233276588348Df` | [View on Explorer](https://sepolia.arbiscan.io/address/0x8ae559448a1482faffC925eF6a233276588348Df) |
```

**Reference**: `claude/deployments/marks-arbitrumSepolia-deployments.md`

---

### Step 17: Run Validation

**Command:**
```bash
npx hardhat run scripts/validateMarketConfigs.ts --network arbitrumSepolia
```

**What It Checks:**
- Position impact factors are safe
- Swap impact factors are safe
- Borrowing rates don't exceed 150% annually
- Funding rates don't exceed 100% annually
- Impact factor ratios are correct
- Market configurations match on-chain state

**Fix Any Issues:**
- **Warnings**: Review but may be acceptable
- **Errors**: MUST fix before production use

**Common Issues:**
- Impact factors too low (unsafe)
- Borrowing/funding rates too high
- Missing required configurations
- Mismatch between config files and on-chain state

**Reference**: `scripts/validateMarketConfigsUtils.ts`

---

## Summary Checklist

Use this checklist to ensure all steps are completed:

### Pre-Deployment
- [ ] Market parameters decided (index, long, short tokens)
- [ ] Market type determined (single-token vs dual-token)

### Deployment
- [ ] Index token deployed and address saved
- [ ] Oracle provider configured for index token
- [ ] Initial price set for index token
- [ ] Token added to `config/tokens.ts`
- [ ] Market config added to `config/markets.ts`
- [ ] Perp config added to `scripts/validateMarketConfigsUtils.ts`
- [ ] Market deployed via hardhat

### Initialization
- [ ] First deposit created with `address(1)` receiver and `minMarketTokens: 0`
- [ ] First deposit executed successfully
- [ ] Second deposit (liquidity) created with your address
- [ ] Second deposit executed successfully
- [ ] Market has sufficient liquidity

### Keeper
- [ ] Token constants added to keeper
- [ ] Market constants added to keeper
- [ ] Market added to MARKETS dict with correct type
- [ ] Ticker added to appropriate feed (stocks or crypto)
- [ ] Token name mapping updated
- [ ] Keeper restarted and monitoring market

### Frontend
- [ ] Index token address added to `client/src/contracts/addresses.js`
- [ ] Token decimals added to TOKEN_DECIMALS
- [ ] Market configuration added to MARKETS object
- [ ] Market added to allMarkets array in `usePositionReader.js`
- [ ] Market added to MARKET_PAIR_MAP in `usePositionReader.js`
- [ ] Token decimals added in `usePositionReader.js`
- [ ] Market address mapping added to `PositionContext.js` (lowercase)
- [ ] Trading pair configuration verified/added in `tradingPairs.js`

### Testing
- [ ] Long position test passed
- [ ] Short position test passed
- [ ] Close long position test passed
- [ ] Close short position test passed
- [ ] PnL calculations verified

### Documentation
- [ ] Deployment documentation updated
- [ ] Market validation passed (no errors)
- [ ] All addresses saved and verified

---

## Critical Points to Remember

### ⚠️ Common Mistakes to Avoid

1. **Index Token Supply**
   - ❌ DON'T mint any tokens
   - ✅ Index token is just for price tracking (stub token)

2. **First Deposit**
   - ❌ DON'T use your address as receiver
   - ✅ MUST use `address(1)` as receiver
   - ❌ DON'T set `minMarketTokens` > 0
   - ✅ MUST set `minMarketTokens: 0`

3. **Token Approvals**
   - ❌ DON'T approve to ExchangeRouter
   - ✅ Approve to Router contract

4. **Price Precision**
   - ❌ DON'T use wrong decimal calculation
   - ✅ Always use: `price * 10^(30 - token_decimals)`

5. **Keeper Updates**
   - ❌ DON'T forget to add market to keeper
   - ✅ Add all constants, MARKETS entry, and ticker
   - ❌ DON'T use wrong type ("stock" vs "crypto")
   - ✅ Use correct type for your market

6. **Validation**
   - ❌ DON'T skip validateMarketConfigs
   - ✅ Always run validation before production

7. **Deposit Vault**
   - ❌ DON'T skip clearing vault check
   - ✅ Always check and clear vault before first deposit

8. **Virtual IDs**
   - ❌ DON'T forget to set virtual IDs
   - ✅ Set both virtualMarketId and virtualTokenIdForIndexToken

---

## Key Lessons from TSLA Deployment

### First Deposit vs Adding Liquidity

The deployment process requires **TWO separate deposits**:

1. **First Deposit** (Market Initialization):
   - Purpose: Initialize market contract state
   - Receiver: `address(1)`
   - MinMarketTokens: `0`
   - Amount: Small (e.g., 1,000)
   - Critical for market to become operational

2. **Second Deposit** (Adding Liquidity):
   - Purpose: Provide actual trading liquidity
   - Receiver: Your address
   - MinMarketTokens: Can be > 0
   - Amount: Large (e.g., 200,000)
   - Enables real trading activity

### Market Type Differences

| Feature | Stock Market | Crypto/Stablecoin Market |
|---------|-------------|--------------------------|
| Index Token | Tracks stock price | Tracks crypto/FX rate |
| Trading Hours | US market hours only | 24/7 |
| Price Feed | Stock API | Crypto API |
| Keeper Type | `"stock"` | `"crypto"` |
| Ticker Location | `stock_tickers` list | Already in crypto feed |
| Example | mTSLA (TSLA stock) | mUSDTNGN (USDT/NGN) |

### Price Precision

All prices use **30 decimals precision** in the system:

```
Final Price = Actual Price × 10^(30 - Token Decimals)

Examples:
- TSLA at $428 (18 decimals): 428 × 10^12
- mUSD at $1 (6 decimals): 1 × 10^24
- USDTNGN at 1,650 (18 decimals): 1,650 × 10^12
```

---

## Reference Files

### Scripts
- Index token deployment: `scripts/deploy-mtsla-token.js`
- Oracle provider setup: `claude/scripts/set-mtsla-provider.js`
- Price setting: `claude/scripts/set-mtsla-price.js`
- First deposit: `claude/scripts/create-deposit-tsla-market.js`
- Execute deposit: `claude/scripts/execute-deposit-tsla-market.js`
- Add liquidity: `claude/scripts/create-deposit-tsla-200k.js`
- Test long order: `claude/scripts/create-test-order-tsla.js`
- Test short order: `claude/scripts/create-test-order-tsla-short.js`
- Close long: `claude/scripts/close-tsla-position.js`
- Close short: `claude/scripts/close-tsla-short-position.js`

### Configuration Files
- Tokens: `config/tokens.ts:1416`
- Markets: `config/markets.ts:4863`
- Validation: `scripts/validateMarketConfigsUtils.ts:667`
- Keeper: `keeper/order_keeper_v2.py`

### Deployment Files
- Market deployment: `deploy/deployAndConfigureMarkets.ts:40`
- Documentation: `claude/deployments/marks-arbitrumSepolia-deployments.md`

---

## Need Help?

If you encounter issues:

1. Check this guide's "Common Mistakes" section
2. Review reference scripts for similar markets
3. Run validateMarketConfigs to identify configuration issues
4. Check keeper logs for execution errors
5. Verify all addresses are correct in all files

---

**Document Version**: 1.0
**Last Updated**: Based on TSLA market deployment (October 2025)
**Network**: Arbitrum Sepolia (Testnet)
