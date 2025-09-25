const { ethers } = require("hardhat");

// ==========================================
// CONFIGURATION - Update these addresses
// ==========================================
const ADDRESSES = {
  USDT: "0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6",
  sNGN: "0xe0dBA0326623dEcE1712581271ebcD846D67b29f", // Synthetic NGN token
  USDTNGN_MARKET: "0xf95B450B9f4677A654201e637883854123e98C22",
  ROUTER: "0x04dCDC9569cb3C121a5EC31C2FBfDA2eA8A80655",
  EXCHANGE_ROUTER: "0x5b4dEa447745a38822a0644424AD2EAC3F151f5C",
  DEPOSIT_HANDLER: "0xeed8952ddBE9A770123dDe13eDb7372476c2053F",
  DEPOSIT_VAULT: "0x784Ca5B934A10c7Ca9219bCb09bb9A073218E0C0",
  WITHDRAWAL_HANDLER: "0x[YOUR_WITHDRAWAL_HANDLER]", // Add this
  WITHDRAWAL_VAULT: "0x[YOUR_WITHDRAWAL_VAULT]", // Add this
  DATA_STORE: "0xE0bf5B90c1d6B1381Ca28BBdb849641C18bcFdf5",
  ORACLE: "0x178a0F71bAB704b989A9930E109aBC11eE9beCe0" // Your deployed oracle
};

// Fixed USDT price (stablecoin always $1)
const USDT_PRICE = ethers.utils.parseUnits("1", 30); // $1.00 with 30 decimals

// ==========================================
// STEP 1: APPROVE USDT FOR ROUTER
// ==========================================
async function approveUSDT(signer, amount) {
  console.log("\n=== Step 1: Approving USDT ===");
  
  const usdt = await ethers.getContractAt(
    ["function approve(address spender, uint256 amount) external returns (bool)"],
    ADDRESSES.USDT,
    signer
  );
  
  const tx = await usdt.approve(ADDRESSES.ROUTER, amount);
  await tx.wait();
  
  console.log(`✅ Approved ${ethers.utils.formatUnits(amount, 6)} USDT for Router`);
  console.log(`   TX: ${tx.hash}`);
  
  return tx;
}

// ==========================================
// STEP 2: CREATE DEPOSIT REQUEST
// ==========================================
async function createDeposit(signer, usdtAmount) {
  console.log("\n=== Step 2: Creating Deposit Request ===");
  
  const exchangeRouter = await ethers.getContractAt(
    [
      "function createDeposit(tuple(tuple(address receiver, address callbackContract, address uiFeeReceiver, address market, address initialLongToken, address initialShortToken, address[] longTokenSwapPath, address[] shortTokenSwapPath) addresses, tuple(uint256 minMarketTokens, bool shouldUnwrapNativeToken, uint256 executionFee, uint256 callbackGasLimit) numbers, bytes32[] dataList) params) external payable returns (bytes32)"
    ],
    ADDRESSES.EXCHANGE_ROUTER,
    signer
  );
  
  // Split USDT equally between long and short sides
  const halfAmount = usdtAmount.div(2);
  
  const depositParams = {
    addresses: {
      receiver: signer.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: ADDRESSES.USDTNGN_MARKET,
      initialLongToken: ADDRESSES.USDT,
      initialShortToken: ADDRESSES.USDT,
      longTokenSwapPath: [],
      shortTokenSwapPath: []
    },
    numbers: {
      minMarketTokens: 0, // No slippage protection for testing
      shouldUnwrapNativeToken: false,
      executionFee: ethers.utils.parseEther("0.001"), // Execution fee in ETH
      callbackGasLimit: 0
    },
    dataList: []
  };
  
  // First, transfer USDT to DepositVault using Router
  const router = await ethers.getContractAt(
    [
      "function sendTokens(address token, address receiver, uint256 amount) external"
    ],
    ADDRESSES.ROUTER,
    signer
  );
  
  // Transfer long token amount
  console.log(`   Transferring ${ethers.utils.formatUnits(halfAmount, 6)} USDT for long side...`);
  const tx1 = await router.sendTokens(ADDRESSES.USDT, ADDRESSES.DEPOSIT_VAULT, halfAmount);
  await tx1.wait();
  
  // Transfer short token amount  
  console.log(`   Transferring ${ethers.utils.formatUnits(halfAmount, 6)} USDT for short side...`);
  const tx2 = await router.sendTokens(ADDRESSES.USDT, ADDRESSES.DEPOSIT_VAULT, halfAmount);
  await tx2.wait();
  
  // Create the deposit request
  console.log("   Creating deposit request...");
  const tx = await exchangeRouter.createDeposit(depositParams, {
    value: ethers.utils.parseEther("0.001") // Send execution fee
  });
  
  const receipt = await tx.wait();
  
  // Extract deposit key from events
  const depositCreatedEvent = receipt.logs.find(log => {
    try {
      const parsed = ethers.utils.defaultAbiCoder.decode(
        ["bytes32", "address", "address", "uint256"],
        log.data
      );
      return true;
    } catch {
      return false;
    }
  });
  
  const depositKey = depositCreatedEvent ? 
    ethers.utils.defaultAbiCoder.decode(["bytes32"], depositCreatedEvent.topics[1])[0] : 
    "0x" + receipt.logs[0].topics[1].slice(2);
    
  console.log(`✅ Deposit request created`);
  console.log(`   Deposit Key: ${depositKey}`);
  console.log(`   TX: ${tx.hash}`);
  
  return depositKey;
}

// ==========================================
// STEP 3: EXECUTE DEPOSIT (MANUAL)
// ==========================================
async function executeDeposit(signer, depositKey) {
  console.log("\n=== Step 3: Executing Deposit ===");
  
  const depositHandler = await ethers.getContractAt(
    [
      "function executeDeposit(bytes32 key, tuple(address[] tokens, address[] providers, bytes[] data) oracleParams) external"
    ],
    ADDRESSES.DEPOSIT_HANDLER,
    signer
  );
  
  // Get current prices from your Oracle
  const oracle = await ethers.getContractAt(
    [
      "function getPrimaryPrice(address token) external view returns (tuple(uint256 min, uint256 max) price)"
    ],
    ADDRESSES.ORACLE,
    signer
  );
  
  // Fetch current prices from oracle
  const usdtPrice = await oracle.getPrimaryPrice(ADDRESSES.USDT);
  const ngnPrice = await oracle.getPrimaryPrice("0x0000000000000000000000000000000000000001"); // NGN placeholder address
  
  console.log("   Current Oracle Prices:");
  console.log(`   - USDT: ${ethers.utils.formatUnits(usdtPrice.min, 30)}`);
  console.log(`   - NGN: ${ethers.utils.formatUnits(ngnPrice.min, 30)} (${(1 / parseFloat(ethers.utils.formatUnits(ngnPrice.min, 30))).toFixed(2)} NGN/USD)`);
  
  // Construct oracle params for execution
  // GMX expects specific format for oracle data
  const currentBlockTime = Math.floor(Date.now() / 1000);
  const oracleParams = {
    tokens: [ADDRESSES.USDT, "0x0000000000000000000000000000000000000001"], // USDT and NGN placeholder
    providers: [ADDRESSES.ORACLE, ADDRESSES.ORACLE], // Your oracle contract as provider
    data: [
      encodeOraclePriceWithTimestamp(usdtPrice.min, usdtPrice.max, currentBlockTime),
      encodeOraclePriceWithTimestamp(ngnPrice.min, ngnPrice.max, currentBlockTime)
    ]
  };
  
  const tx = await depositHandler.executeDeposit(depositKey, oracleParams);
  const receipt = await tx.wait();
  
  console.log(`✅ Deposit executed successfully`);
  console.log(`   TX: ${tx.hash}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  
  // Check market token balance
  await checkMarketTokenBalance(signer);
  
  return receipt;
}

// ==========================================
// WITHDRAWAL FUNCTIONS
// ==========================================
async function createWithdrawal(signer, marketTokenAmount) {
  console.log("\n=== Creating Withdrawal Request ===");
  
  const exchangeRouter = await ethers.getContractAt(
    [
      "function createWithdrawal(tuple(tuple(address receiver, address callbackContract, address uiFeeReceiver, address market, address[] longTokenSwapPath, address[] shortTokenSwapPath) addresses, tuple(uint256 minLongTokenAmount, uint256 minShortTokenAmount, bool shouldUnwrapNativeToken, uint256 executionFee, uint256 callbackGasLimit) numbers, bytes32[] dataList) params) external payable returns (bytes32)"
    ],
    ADDRESSES.EXCHANGE_ROUTER,
    signer
  );
  
  // First approve market tokens to Router
  const marketToken = await ethers.getContractAt(
    ["function approve(address spender, uint256 amount) external returns (bool)"],
    ADDRESSES.USDTNGN_MARKET,
    signer
  );
  
  console.log("   Approving market tokens...");
  const approveTx = await marketToken.approve(ADDRESSES.ROUTER, marketTokenAmount);
  await approveTx.wait();
  
  const withdrawalParams = {
    addresses: {
      receiver: signer.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: ADDRESSES.USDTNGN_MARKET,
      longTokenSwapPath: [],
      shortTokenSwapPath: []
    },
    numbers: {
      minLongTokenAmount: 0,  // No slippage protection
      minShortTokenAmount: 0, // No slippage protection
      shouldUnwrapNativeToken: false,
      executionFee: ethers.utils.parseEther("0.001"),
      callbackGasLimit: 0
    },
    dataList: []
  };
  
  // Transfer market tokens to WithdrawalVault
  const router = await ethers.getContractAt(
    ["function sendTokens(address token, address receiver, uint256 amount) external"],
    ADDRESSES.ROUTER,
    signer
  );
  
  console.log(`   Transferring market tokens to WithdrawalVault...`);
  const transferTx = await router.sendTokens(
    ADDRESSES.USDTNGN_MARKET,
    ADDRESSES.WITHDRAWAL_VAULT,
    marketTokenAmount
  );
  await transferTx.wait();
  
  // Create withdrawal request
  console.log("   Creating withdrawal request...");
  const tx = await exchangeRouter.createWithdrawal(withdrawalParams, {
    value: ethers.utils.parseEther("0.001")
  });
  
  const receipt = await tx.wait();
  
  // Extract withdrawal key from events
  const withdrawalKey = "0x" + receipt.logs[0].topics[1].slice(2);
  
  console.log(`✅ Withdrawal request created`);
  console.log(`   Withdrawal Key: ${withdrawalKey}`);
  console.log(`   TX: ${tx.hash}`);
  
  return withdrawalKey;
}

async function executeWithdrawal(signer, withdrawalKey) {
  console.log("\n=== Executing Withdrawal ===");
  
  const withdrawalHandler = await ethers.getContractAt(
    [
      "function executeWithdrawal(bytes32 key, tuple(address[] tokens, address[] providers, bytes[] data) oracleParams) external"
    ],
    ADDRESSES.WITHDRAWAL_HANDLER,
    signer
  );
  
  // Get current sNGN price from your Oracle
  const oracle = await ethers.getContractAt(
    [
      "function getPrimaryPrice(address token) external view returns (tuple(uint256 min, uint256 max) price)"
    ],
    ADDRESSES.ORACLE,
    signer
  );
  
  // Fetch current sNGN price
  const sNgnPrice = await oracle.getPrimaryPrice(ADDRESSES.sNGN);
  
  const currentBlockTime = Math.floor(Date.now() / 1000);
  const oracleParams = {
    tokens: [ADDRESSES.USDT, ADDRESSES.sNGN],
    providers: [ADDRESSES.ORACLE, ADDRESSES.ORACLE],
    data: [
      encodeOraclePriceWithTimestamp(USDT_PRICE, USDT_PRICE, currentBlockTime), // USDT always $1
      encodeOraclePriceWithTimestamp(sNgnPrice.min, sNgnPrice.max, currentBlockTime)
    ]
  };
  
  const tx = await withdrawalHandler.executeWithdrawal(withdrawalKey, oracleParams);
  const receipt = await tx.wait();
  
  console.log(`✅ Withdrawal executed successfully`);
  console.log(`   TX: ${tx.hash}`);
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
  
  // Check USDT balance
  await checkUSDTBalance(signer);
  
  return receipt;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function encodeOraclePriceWithTimestamp(minPrice, maxPrice, timestamp) {
  // GMX V2 oracle data format includes timestamp and price data
  // The exact encoding depends on your Oracle implementation
  return ethers.utils.defaultAbiCoder.encode(
    ["uint256", "uint256", "uint256"],
    [minPrice, maxPrice, timestamp]
  );
}

// Fallback for testing without live oracle
function encodeOraclePrice(minPrice, maxPrice) {
  return ethers.utils.defaultAbiCoder.encode(
    ["uint256", "uint256"],
    [minPrice, maxPrice]
  );
}

async function checkMarketTokenBalance(signer) {
  const marketToken = await ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    ADDRESSES.USDTNGN_MARKET,
    signer
  );
  
  const balance = await marketToken.balanceOf(signer.address);
  console.log(`\n📊 Market Token Balance: ${ethers.utils.formatUnits(balance, 18)}`);
  
  return balance;
}

async function checkUSDTBalance(signer) {
  const usdt = await ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    ADDRESSES.USDT,
    signer
  );
  
  const balance = await usdt.balanceOf(signer.address);
  console.log(`\n💰 USDT Balance: ${ethers.utils.formatUnits(balance, 6)}`);
  
  return balance;
}

async function checkPoolBalance() {
  const usdt = await ethers.getContractAt(
    ["function balanceOf(address account) external view returns (uint256)"],
    ADDRESSES.USDT
  );
  
  const marketBalance = await usdt.balanceOf(ADDRESSES.USDTNGN_MARKET);
  console.log(`\n🏊 Pool USDT Balance: ${ethers.utils.formatUnits(marketBalance, 6)}`);
  
  return marketBalance;
}

// ==========================================
// MAIN EXECUTION FUNCTION
// ==========================================
async function main() {
  console.log("========================================");
  console.log("USDTNGN MARKET LIQUIDITY TEST");
  console.log("========================================");
  
  const [signer] = await ethers.getSigners();
  console.log(`\nUsing account: ${signer.address}`);
  
  // Test amounts
  const depositAmount = ethers.utils.parseUnits("100", 6); // $100 USDT
  
  try {
    // Check initial balances
    console.log("\n=== Initial Balances ===");
    await checkUSDTBalance(signer);
    await checkMarketTokenBalance(signer);
    await checkPoolBalance();
    
    // ===== DEPOSIT TEST =====
    console.log("\n========================================");
    console.log("TESTING DEPOSIT ($100)");
    console.log("========================================");
    
    // Step 1: Approve USDT
    await approveUSDT(signer, depositAmount);
    
    // Step 2: Create deposit
    const depositKey = await createDeposit(signer, depositAmount);
    
    // Wait a bit for block timestamp
    console.log("\n⏳ Waiting for block timestamp update...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Execute deposit
    await executeDeposit(signer, depositKey);
    
    // Check pool balance after deposit
    await checkPoolBalance();
    
    // ===== WITHDRAWAL TEST =====
    console.log("\n========================================");
    console.log("TESTING WITHDRAWAL");
    console.log("========================================");
    
    // Get market token balance
    const marketTokenBalance = await checkMarketTokenBalance(signer);
    
    if (marketTokenBalance.gt(0)) {
      // Withdraw all market tokens
      const withdrawalKey = await createWithdrawal(signer, marketTokenBalance);
      
      // Wait for block timestamp
      console.log("\n⏳ Waiting for block timestamp update...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Execute withdrawal
      await executeWithdrawal(signer, withdrawalKey);
      
      // Final balance check
      console.log("\n=== Final Balances ===");
      await checkUSDTBalance(signer);
      await checkMarketTokenBalance(signer);
      await checkPoolBalance();
    } else {
      console.log("❌ No market tokens to withdraw");
    }
    
    console.log("\n✅ All tests completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  approveUSDT,
  createDeposit,
  executeDeposit,
  createWithdrawal,
  executeWithdrawal,
  checkMarketTokenBalance,
  checkUSDTBalance,
  checkPoolBalance
};