# Marks Arbitrum Sepolia Deployments

**Network Type:** Testnet  
**Chain ID:** 421614  
**Total Contracts:** 90  
**Last Generated:** Tue, 23 Sep 2025 20:50:55 GMT

## Deployment Purpose

This deployment is a fork of GMX V2 for the Marks protocol, creating synthetic Nigerian Naira (sNGN) perpetual markets.

## Custom Tokens

| Name | Symbol | Address | Decimals | Link |
|------|--------|---------|----------|------|
| Test USDT | USDT | `0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6` | 6 | [View on Explorer](https://sepolia.arbiscan.io/address/0x5fE0CA3aF9Cf758D7F4159295Fd1Cd6a05562bb6) |
| Synthetic Nigerian Naira | sNGN | `0xd66e60AA5b6982649a116e6944Daec22b15468Ad` | 18 | [View on Explorer](https://sepolia.arbiscan.io/address/0xd66e60AA5b6982649a116e6944Daec22b15468Ad) |

## Markets

| Market | Index Token | Long Token | Short Token | Market Token | Link |
|--------|-------------|------------|-------------|--------------|------|
| Market 1: sNGN [USDT-sNGN] | sNGN | USDT | sNGN | `0x53b49A28054D108d7050B0E5C317001bE984EB2D` | [View on Explorer](https://sepolia.arbiscan.io/address/0x53b49A28054D108d7050B0E5C317001bE984EB2D) |
| Market 2: sNGN [USDT-USDT] | sNGN | USDT | USDT | `0xb1faf4aFd5bd6aA53CF056BBA31CCa1C44234a24` | [View on Explorer](https://sepolia.arbiscan.io/address/0xb1faf4aFd5bd6aA53CF056BBA31CCa1C44234a24) |
| Market 3: USDT [USDT-sNGN] | USDT | sNGN | USDT | `0x8E4C5f3296A100d4135187C3181258cb8a223bb1` | [View on Explorer](https://sepolia.arbiscan.io/address/0x8E4C5f3296A100d4135187C3181258cb8a223bb1) |

## Core Contracts

| Name | Address | Link |
|------|---------|------|
| DataStore | `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111` | [View on Explorer](https://sepolia.arbiscan.io/address/0xD70154A2e4BEF0485Bb6d90265a4F878A4556111) |
| EventEmitter | `0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C` | [View on Explorer](https://sepolia.arbiscan.io/address/0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C) |
| ExchangeRouter | `0x3B33708e9b8242999459EB9b4756C24c846e5936` | [View on Explorer](https://sepolia.arbiscan.io/address/0x3B33708e9b8242999459EB9b4756C24c846e5936) |
| MarketFactory | `0x32697b40be5537c7cF198a898a09BE11b14ce8bE` | [View on Explorer](https://sepolia.arbiscan.io/address/0x32697b40be5537c7cF198a898a09BE11b14ce8bE) |
| Oracle | `0xE89d94669f49D278cCD094A084139eB6639C0a93` | [View on Explorer](https://sepolia.arbiscan.io/address/0xE89d94669f49D278cCD094A084139eB6639C0a93) |
| OracleStore | `0xBc2408eF555c05A471A8242ef640061910EA4FD0` | [View on Explorer](https://sepolia.arbiscan.io/address/0xBc2408eF555c05A471A8242ef640061910EA4FD0) |
| RoleStore | `0x4943c063691259B677f3D7BC808C9C3090321EbB` | [View on Explorer](https://sepolia.arbiscan.io/address/0x4943c063691259B677f3D7BC808C9C3090321EbB) |
| Router | `0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc` | [View on Explorer](https://sepolia.arbiscan.io/address/0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc) |

## Vaults

| Name | Address | Link |
|------|---------|------|
| DepositVault | `0x8672091de3AF3a02bE48cFB753810A736D9F6379` | [View on Explorer](https://sepolia.arbiscan.io/address/0x8672091de3AF3a02bE48cFB753810A736D9F6379) |
| GlvVault | `0xa736666971e7aa6Fdf61d532d3027a162597EBf5` | [View on Explorer](https://sepolia.arbiscan.io/address/0xa736666971e7aa6Fdf61d532d3027a162597EBf5) |
| MultichainVault | `0x832dB4016bF4AFe98BB90BBb9F9375B0A1409D4b` | [View on Explorer](https://sepolia.arbiscan.io/address/0x832dB4016bF4AFe98BB90BBb9F9375B0A1409D4b) |
| OrderVault | `0xc58D48fc072641D3e1F70D884AFdFd804483dc6F` | [View on Explorer](https://sepolia.arbiscan.io/address/0xc58D48fc072641D3e1F70D884AFdFd804483dc6F) |
| ShiftVault | `0x48d917dDaAAfaa12A53aAE4F8b663709C3c292f2` | [View on Explorer](https://sepolia.arbiscan.io/address/0x48d917dDaAAfaa12A53aAE4F8b663709C3c292f2) |
| WithdrawalVault | `0x61a7C95B28eC4B3809D0DFb810A01D57bA7F8F68` | [View on Explorer](https://sepolia.arbiscan.io/address/0x61a7C95B28eC4B3809D0DFb810A01D57bA7F8F68) |

## Handlers

| Name | Address | Link |
|------|---------|------|
| DepositHandler | `0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00` | [View on Explorer](https://sepolia.arbiscan.io/address/0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00) |
| ExternalHandler | `0x04e20Ced670b901f5763Fd16bF31CF6b03499a2E` | [View on Explorer](https://sepolia.arbiscan.io/address/0x04e20Ced670b901f5763Fd16bF31CF6b03499a2E) |
| GlvDepositHandler | `0x819b6B5B9C6d56629adf82B52B25aA6AEeaA16cc` | [View on Explorer](https://sepolia.arbiscan.io/address/0x819b6B5B9C6d56629adf82B52B25aA6AEeaA16cc) |
| GlvWithdrawalHandler | `0xFD790Fd45eCC932E71717413bA4f096FbfA9eC4B` | [View on Explorer](https://sepolia.arbiscan.io/address/0xFD790Fd45eCC932E71717413bA4f096FbfA9eC4B) |
| OrderHandler | `0x83f2D66af7f794893C31c0B32BD2D4cE826871d7` | [View on Explorer](https://sepolia.arbiscan.io/address/0x83f2D66af7f794893C31c0B32BD2D4cE826871d7) |
| ShiftHandler | `0x753b1B6F655b29102E4A929C83eD65c8DecF5739` | [View on Explorer](https://sepolia.arbiscan.io/address/0x753b1B6F655b29102E4A929C83eD65c8DecF5739) |
| SwapHandler | `0x0Fb79fB331116AF87775B86d576fAae57A2DCAde` | [View on Explorer](https://sepolia.arbiscan.io/address/0x0Fb79fB331116AF87775B86d576fAae57A2DCAde) |
| WithdrawalHandler | `0x95E26343227D437Ad62b594C772828b77A966675` | [View on Explorer](https://sepolia.arbiscan.io/address/0x95E26343227D437Ad62b594C772828b77A966675) |

## Order Executors

| Name | Address | Link |
|------|---------|------|
| DecreaseOrderExecutor | `0xf8E9Ace5a33c48d6FA3DFf3e9Dd3a4F51627fbD7` | [View on Explorer](https://sepolia.arbiscan.io/address/0xf8E9Ace5a33c48d6FA3DFf3e9Dd3a4F51627fbD7) |
| IncreaseOrderExecutor | `0xc84c45423c40Dc41B27d29C66A14152a86d2106E` | [View on Explorer](https://sepolia.arbiscan.io/address/0xc84c45423c40Dc41B27d29C66A14152a86d2106E) |
| SwapOrderExecutor | `0x3B738B9Fac5bf7C454Ce5b407f42bC1111fE3d38` | [View on Explorer](https://sepolia.arbiscan.io/address/0x3B738B9Fac5bf7C454Ce5b407f42bC1111fE3d38) |

## All Deployed Contracts

| Name | Address | Link |
|------|---------|------|
| BaseOrderUtils | `0xb6f827A9F7A13D4CCFDAa5477e2a0114C4B36D55` | [View on Explorer](https://sepolia.arbiscan.io/address/0xb6f827A9F7A13D4CCFDAa5477e2a0114C4B36D55) |
| BridgeOutFromControllerUtils | `0xeA842D4CAAE61390B5A1Ef0506300E3DE84fEDf7` | [View on Explorer](https://sepolia.arbiscan.io/address/0xeA842D4CAAE61390B5A1Ef0506300E3DE84fEDf7) |
| CallbackUtils | `0xc694B7F41246236De2164405d616B41aDB0B766c` | [View on Explorer](https://sepolia.arbiscan.io/address/0xc694B7F41246236De2164405d616B41aDB0B766c) |
| Config | `0x67d921e3C19b5ED8c9a2252b96D1342Ba02421a6` | [View on Explorer](https://sepolia.arbiscan.io/address/0x67d921e3C19b5ED8c9a2252b96D1342Ba02421a6) |
| ConfigUtils | `0xD6BE3E0A23BD8Ca88a91439CC9E7c3Fae56Daf2f` | [View on Explorer](https://sepolia.arbiscan.io/address/0xD6BE3E0A23BD8Ca88a91439CC9E7c3Fae56Daf2f) |
| DataStore | `0xD70154A2e4BEF0485Bb6d90265a4F878A4556111` | [View on Explorer](https://sepolia.arbiscan.io/address/0xD70154A2e4BEF0485Bb6d90265a4F878A4556111) |
| DecreaseOrderExecutor | `0xf8E9Ace5a33c48d6FA3DFf3e9Dd3a4F51627fbD7` | [View on Explorer](https://sepolia.arbiscan.io/address/0xf8E9Ace5a33c48d6FA3DFf3e9Dd3a4F51627fbD7) |
| DecreaseOrderUtils | `0x9cd2a72f07F862Bb07E7B8b1c7D8e4Bb5FF32884` | [View on Explorer](https://sepolia.arbiscan.io/address/0x9cd2a72f07F862Bb07E7B8b1c7D8e4Bb5FF32884) |
| DecreasePositionCollateralUtils | `0xc98e7c4ddB2Acd9e89c6C2ae69FCfF2Bb1EbF149` | [View on Explorer](https://sepolia.arbiscan.io/address/0xc98e7c4ddB2Acd9e89c6C2ae69FCfF2Bb1EbF149) |
| DecreasePositionSwapUtils | `0x5973Ae33C0E0dB19A4D8412E9BEc1F4363504Cc4` | [View on Explorer](https://sepolia.arbiscan.io/address/0x5973Ae33C0E0dB19A4D8412E9BEc1F4363504Cc4) |
| DecreasePositionUtils | `0x3E5E8e1Dd93d3fC7FdD8c711697B2403FcCBF428` | [View on Explorer](https://sepolia.arbiscan.io/address/0x3E5E8e1Dd93d3fC7FdD8c711697B2403FcCBF428) |
| DepositEventUtils | `0xe7F54648EEbFAC1Be9e446e201AfC8C69B24090F` | [View on Explorer](https://sepolia.arbiscan.io/address/0xe7F54648EEbFAC1Be9e446e201AfC8C69B24090F) |
| DepositHandler | `0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00` | [View on Explorer](https://sepolia.arbiscan.io/address/0x91829f4Aa7CB2560aDB30e543b994575f3fE0D00) |
| DepositStoreUtils | `0x20B633d5dBb662E6E23f7C809ca28959Fe6b6316` | [View on Explorer](https://sepolia.arbiscan.io/address/0x20B633d5dBb662E6E23f7C809ca28959Fe6b6316) |
| DepositUtils | `0x832E48fAFeEA6fa905C73cFAA66ae9b0f6AE1C5a` | [View on Explorer](https://sepolia.arbiscan.io/address/0x832E48fAFeEA6fa905C73cFAA66ae9b0f6AE1C5a) |
| DepositVault | `0x8672091de3AF3a02bE48cFB753810A736D9F6379` | [View on Explorer](https://sepolia.arbiscan.io/address/0x8672091de3AF3a02bE48cFB753810A736D9F6379) |
| EventEmitter | `0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C` | [View on Explorer](https://sepolia.arbiscan.io/address/0x3BFbE4d5cB3EEC123Dbbba76c5c78fF8b43b8C0C) |
| ExchangeRouter | `0x3B33708e9b8242999459EB9b4756C24c846e5936` | [View on Explorer](https://sepolia.arbiscan.io/address/0x3B33708e9b8242999459EB9b4756C24c846e5936) |
| ExecuteDepositUtils | `0xA503F72CdDa766890d83994c64360b35B975edb5` | [View on Explorer](https://sepolia.arbiscan.io/address/0xA503F72CdDa766890d83994c64360b35B975edb5) |
| ExecuteGlvDepositUtils | `0x68Aa87e034CB277a36297A36F572650721cbe799` | [View on Explorer](https://sepolia.arbiscan.io/address/0x68Aa87e034CB277a36297A36F572650721cbe799) |
| ExecuteOrderUtils | `0xe805c139529ED29bE43c8fe12a423154Cc9858d5` | [View on Explorer](https://sepolia.arbiscan.io/address/0xe805c139529ED29bE43c8fe12a423154Cc9858d5) |
| ExecuteWithdrawalUtils | `0x4CF660D71348C9a51AaF567F22dc40947bcEf85C` | [View on Explorer](https://sepolia.arbiscan.io/address/0x4CF660D71348C9a51AaF567F22dc40947bcEf85C) |
| ExternalHandler | `0x04e20Ced670b901f5763Fd16bF31CF6b03499a2E` | [View on Explorer](https://sepolia.arbiscan.io/address/0x04e20Ced670b901f5763Fd16bF31CF6b03499a2E) |
| FeeUtils | `0x2f2f43c8b1861635b7b54438997d07D57EbD8090` | [View on Explorer](https://sepolia.arbiscan.io/address/0x2f2f43c8b1861635b7b54438997d07D57EbD8090) |
| GasUtils | `0xa18cA547f8d13D37e25055A5B99ab55D15941de8` | [View on Explorer](https://sepolia.arbiscan.io/address/0xa18cA547f8d13D37e25055A5B99ab55D15941de8) |
| GlvDepositCalc | `0xEAe8D7D04a31cBfAfA20449fAa140861C29dffA7` | [View on Explorer](https://sepolia.arbiscan.io/address/0xEAe8D7D04a31cBfAfA20449fAa140861C29dffA7) |
| GlvDepositEventUtils | `0xCBB7A8b76638A7088efB4d9EcA6bDbBaDB8178e7` | [View on Explorer](https://sepolia.arbiscan.io/address/0xCBB7A8b76638A7088efB4d9EcA6bDbBaDB8178e7) |
| GlvDepositHandler | `0x819b6B5B9C6d56629adf82B52B25aA6AEeaA16cc` | [View on Explorer](https://sepolia.arbiscan.io/address/0x819b6B5B9C6d56629adf82B52B25aA6AEeaA16cc) |
| GlvDepositStoreUtils | `0xbB9ee2e1a3aa9bEF024656C060EF6C0a18Dfc642` | [View on Explorer](https://sepolia.arbiscan.io/address/0xbB9ee2e1a3aa9bEF024656C060EF6C0a18Dfc642) |
| GlvDepositUtils | `0x0Fe470b4D747480bD91c5bcf6e3135c3A801cb7F` | [View on Explorer](https://sepolia.arbiscan.io/address/0x0Fe470b4D747480bD91c5bcf6e3135c3A801cb7F) |
| GlvStoreUtils | `0xe709484783a686B8964d878B07ff49D271C65D25` | [View on Explorer](https://sepolia.arbiscan.io/address/0xe709484783a686B8964d878B07ff49D271C65D25) |
| GlvUtils | `0xd1D3865fE34Ed32024ad7F1DFEf760f711eb4D23` | [View on Explorer](https://sepolia.arbiscan.io/address/0xd1D3865fE34Ed32024ad7F1DFEf760f711eb4D23) |
| GlvVault | `0xa736666971e7aa6Fdf61d532d3027a162597EBf5` | [View on Explorer](https://sepolia.arbiscan.io/address/0xa736666971e7aa6Fdf61d532d3027a162597EBf5) |
| GlvWithdrawalEventUtils | `0x698C462Af948F41D5843A0Eb424d9C6B78cf63D4` | [View on Explorer](https://sepolia.arbiscan.io/address/0x698C462Af948F41D5843A0Eb424d9C6B78cf63D4) |
| GlvWithdrawalHandler | `0xFD790Fd45eCC932E71717413bA4f096FbfA9eC4B` | [View on Explorer](https://sepolia.arbiscan.io/address/0xFD790Fd45eCC932E71717413bA4f096FbfA9eC4B) |
| GlvWithdrawalStoreUtils | `0xE4288fcBA973444Eb5A36EAE2B0b33b9aF116F6E` | [View on Explorer](https://sepolia.arbiscan.io/address/0xE4288fcBA973444Eb5A36EAE2B0b33b9aF116F6E) |
| GlvWithdrawalUtils | `0xbBbB69A31eB3429A6a92e709fd65869622176f21` | [View on Explorer](https://sepolia.arbiscan.io/address/0xbBbB69A31eB3429A6a92e709fd65869622176f21) |
| IncreaseOrderExecutor | `0xc84c45423c40Dc41B27d29C66A14152a86d2106E` | [View on Explorer](https://sepolia.arbiscan.io/address/0xc84c45423c40Dc41B27d29C66A14152a86d2106E) |
| IncreaseOrderUtils | `0x98AB5Ae188Dc23949cACbfB70865D3e210C2Fc51` | [View on Explorer](https://sepolia.arbiscan.io/address/0x98AB5Ae188Dc23949cACbfB70865D3e210C2Fc51) |
| IncreasePositionUtils | `0xD3FB0FfDD4E538F2dCeB3385bfA13fD44502A8f8` | [View on Explorer](https://sepolia.arbiscan.io/address/0xD3FB0FfDD4E538F2dCeB3385bfA13fD44502A8f8) |
| LayerZeroProvider | `0x96ADd7A881441A61cff9a87988123B428fd78A20` | [View on Explorer](https://sepolia.arbiscan.io/address/0x96ADd7A881441A61cff9a87988123B428fd78A20) |
| MarketEventUtils | `0xc0842Dc39AC3dcAB568994E2dA9EEB4d8448BF2e` | [View on Explorer](https://sepolia.arbiscan.io/address/0xc0842Dc39AC3dcAB568994E2dA9EEB4d8448BF2e) |
| MarketFactory | `0x32697b40be5537c7cF198a898a09BE11b14ce8bE` | [View on Explorer](https://sepolia.arbiscan.io/address/0x32697b40be5537c7cF198a898a09BE11b14ce8bE) |
| MarketStoreUtils | `0xCc45d1DA7d7487D90f941a4bc61DDFEBD13ee777` | [View on Explorer](https://sepolia.arbiscan.io/address/0xCc45d1DA7d7487D90f941a4bc61DDFEBD13ee777) |
| MarketUtils | `0x72D1202018FeE0c1b5CD4B472598dF06D3781dA4` | [View on Explorer](https://sepolia.arbiscan.io/address/0x72D1202018FeE0c1b5CD4B472598dF06D3781dA4) |
| Multicall3 | `0xC1B5aC45870A2E206F5A432890E79793De5F8E03` | [View on Explorer](https://sepolia.arbiscan.io/address/0xC1B5aC45870A2E206F5A432890E79793De5F8E03) |
| MultichainGlvRouter | `0x7beA75AF8AD519410d0c94311c05D604Bf79Eee9` | [View on Explorer](https://sepolia.arbiscan.io/address/0x7beA75AF8AD519410d0c94311c05D604Bf79Eee9) |
| MultichainGmRouter | `0xaFE05f5a7f84166f910614589EE11f0E5646AF16` | [View on Explorer](https://sepolia.arbiscan.io/address/0xaFE05f5a7f84166f910614589EE11f0E5646AF16) |
| MultichainOrderRouter | `0x9aA2bfD4318f1c0C760408f469dcd6a88ccFA2B5` | [View on Explorer](https://sepolia.arbiscan.io/address/0x9aA2bfD4318f1c0C760408f469dcd6a88ccFA2B5) |
| MultichainTransferRouter | `0x77Dc2ceeaA0155DAEA6a6f0A131CDF587b96514D` | [View on Explorer](https://sepolia.arbiscan.io/address/0x77Dc2ceeaA0155DAEA6a6f0A131CDF587b96514D) |
| MultichainUtils | `0x71AB6c0bFdF1fE8Ac42fb3f2044dbE32712804AC` | [View on Explorer](https://sepolia.arbiscan.io/address/0x71AB6c0bFdF1fE8Ac42fb3f2044dbE32712804AC) |
| MultichainVault | `0x832dB4016bF4AFe98BB90BBb9F9375B0A1409D4b` | [View on Explorer](https://sepolia.arbiscan.io/address/0x832dB4016bF4AFe98BB90BBb9F9375B0A1409D4b) |
| Oracle | `0xE89d94669f49D278cCD094A084139eB6639C0a93` | [View on Explorer](https://sepolia.arbiscan.io/address/0xE89d94669f49D278cCD094A084139eB6639C0a93) |
| OracleStore | `0xBc2408eF555c05A471A8242ef640061910EA4FD0` | [View on Explorer](https://sepolia.arbiscan.io/address/0xBc2408eF555c05A471A8242ef640061910EA4FD0) |
| OrderEventUtils | `0x66d1FCf5A3DF035DcC708d7A018DAb9cd2e0c214` | [View on Explorer](https://sepolia.arbiscan.io/address/0x66d1FCf5A3DF035DcC708d7A018DAb9cd2e0c214) |
| OrderHandler | `0x83f2D66af7f794893C31c0B32BD2D4cE826871d7` | [View on Explorer](https://sepolia.arbiscan.io/address/0x83f2D66af7f794893C31c0B32BD2D4cE826871d7) |
| OrderStoreUtils | `0x2c655e2198a40a9C3c6f26304dcf68e37b8f331d` | [View on Explorer](https://sepolia.arbiscan.io/address/0x2c655e2198a40a9C3c6f26304dcf68e37b8f331d) |
| OrderUtils | `0x247F920f948F3230a8c3efa6eBd7F33Ee884752e` | [View on Explorer](https://sepolia.arbiscan.io/address/0x247F920f948F3230a8c3efa6eBd7F33Ee884752e) |
| OrderVault | `0xc58D48fc072641D3e1F70D884AFdFd804483dc6F` | [View on Explorer](https://sepolia.arbiscan.io/address/0xc58D48fc072641D3e1F70D884AFdFd804483dc6F) |
| PositionEventUtils | `0xA27136e07095b25E917397f8C838B20DEEe37600` | [View on Explorer](https://sepolia.arbiscan.io/address/0xA27136e07095b25E917397f8C838B20DEEe37600) |
| PositionPricingUtils | `0x68119Ccc96064A292a3145124f7AC97AbFFea2B0` | [View on Explorer](https://sepolia.arbiscan.io/address/0x68119Ccc96064A292a3145124f7AC97AbFFea2B0) |
| PositionStoreUtils | `0x2FfE355cf132A071D018b73CeE80c99A258e94c2` | [View on Explorer](https://sepolia.arbiscan.io/address/0x2FfE355cf132A071D018b73CeE80c99A258e94c2) |
| PositionUtils | `0x08f88540602b42956023cBB6a3d7f3C694c63925` | [View on Explorer](https://sepolia.arbiscan.io/address/0x08f88540602b42956023cBB6a3d7f3C694c63925) |
| Reader | `0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8` | [View on Explorer](https://sepolia.arbiscan.io/address/0xA8c6A5902af85aA8e54560e7E88ddf7253D0C3b8) |
| ReaderDepositUtils | `0xAFF5d51158219F578326BdB2489D64bfbaD29c73` | [View on Explorer](https://sepolia.arbiscan.io/address/0xAFF5d51158219F578326BdB2489D64bfbaD29c73) |
| ReaderPositionUtils | `0x027280C705adD81a690a95C219CB3C6Cc85f4DBf` | [View on Explorer](https://sepolia.arbiscan.io/address/0x027280C705adD81a690a95C219CB3C6Cc85f4DBf) |
| ReaderPricingUtils | `0x528AcA243420316A770e36Dd30686b719Acd883E` | [View on Explorer](https://sepolia.arbiscan.io/address/0x528AcA243420316A770e36Dd30686b719Acd883E) |
| ReaderUtils | `0xd77eB1f2071FA6Ee3da1D2c106B5Ada635fd2621` | [View on Explorer](https://sepolia.arbiscan.io/address/0xd77eB1f2071FA6Ee3da1D2c106B5Ada635fd2621) |
| ReaderWithdrawalUtils | `0x7b5208df7D6150e5Ea2D6c9bB7F32A038A61E05A` | [View on Explorer](https://sepolia.arbiscan.io/address/0x7b5208df7D6150e5Ea2D6c9bB7F32A038A61E05A) |
| ReferralEventUtils | `0x78D19F9cE40aC14CED5fc123834DF068096a8E10` | [View on Explorer](https://sepolia.arbiscan.io/address/0x78D19F9cE40aC14CED5fc123834DF068096a8E10) |
| ReferralStorage | `0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547` | [View on Explorer](https://sepolia.arbiscan.io/address/0x3B6DaA746aB0CE60e8eBF9F6F0157073d2d54547) |
| ReferralUtils | `0x680883a0eddCbfaE0D65Ca45ce6ac018DeC5413f` | [View on Explorer](https://sepolia.arbiscan.io/address/0x680883a0eddCbfaE0D65Ca45ce6ac018DeC5413f) |
| RelayUtils | `0x80EF9863236BC416010BAf8D3C494f5ED7CC38b1` | [View on Explorer](https://sepolia.arbiscan.io/address/0x80EF9863236BC416010BAf8D3C494f5ED7CC38b1) |
| RoleStore | `0x4943c063691259B677f3D7BC808C9C3090321EbB` | [View on Explorer](https://sepolia.arbiscan.io/address/0x4943c063691259B677f3D7BC808C9C3090321EbB) |
| Router | `0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc` | [View on Explorer](https://sepolia.arbiscan.io/address/0x6C71eD3bE6D3966F34162Cbda0195a6778096fAc) |
| ShiftEventUtils | `0x40F5c2aC1ee37D7B3920A3869B44e5CB163c6Bf5` | [View on Explorer](https://sepolia.arbiscan.io/address/0x40F5c2aC1ee37D7B3920A3869B44e5CB163c6Bf5) |
| ShiftHandler | `0x753b1B6F655b29102E4A929C83eD65c8DecF5739` | [View on Explorer](https://sepolia.arbiscan.io/address/0x753b1B6F655b29102E4A929C83eD65c8DecF5739) |
| ShiftStoreUtils | `0x66b827544C4e3DB1E561c5Ce864355624738BdBe` | [View on Explorer](https://sepolia.arbiscan.io/address/0x66b827544C4e3DB1E561c5Ce864355624738BdBe) |
| ShiftUtils | `0x37DAB8Be23427ab7E397590C0FF23cAFa0C100dE` | [View on Explorer](https://sepolia.arbiscan.io/address/0x37DAB8Be23427ab7E397590C0FF23cAFa0C100dE) |
| ShiftVault | `0x48d917dDaAAfaa12A53aAE4F8b663709C3c292f2` | [View on Explorer](https://sepolia.arbiscan.io/address/0x48d917dDaAAfaa12A53aAE4F8b663709C3c292f2) |
| SwapHandler | `0x0Fb79fB331116AF87775B86d576fAae57A2DCAde` | [View on Explorer](https://sepolia.arbiscan.io/address/0x0Fb79fB331116AF87775B86d576fAae57A2DCAde) |
| SwapOrderExecutor | `0x3B738B9Fac5bf7C454Ce5b407f42bC1111fE3d38` | [View on Explorer](https://sepolia.arbiscan.io/address/0x3B738B9Fac5bf7C454Ce5b407f42bC1111fE3d38) |
| SwapOrderUtils | `0xe29F809520a273bD16Ec4C466177f9ea4089BeB0` | [View on Explorer](https://sepolia.arbiscan.io/address/0xe29F809520a273bD16Ec4C466177f9ea4089BeB0) |
| SwapPricingUtils | `0x8a678D08a2EeC4Bd776c698c7A1E38cd7304165A` | [View on Explorer](https://sepolia.arbiscan.io/address/0x8a678D08a2EeC4Bd776c698c7A1E38cd7304165A) |
| SwapUtils | `0x15B24Cad0FdD13827e1Ce47b19010673946da1Fc` | [View on Explorer](https://sepolia.arbiscan.io/address/0x15B24Cad0FdD13827e1Ce47b19010673946da1Fc) |
| WithdrawalEventUtils | `0x989294b158e5BD5700917e82cE800093b6B96BA1` | [View on Explorer](https://sepolia.arbiscan.io/address/0x989294b158e5BD5700917e82cE800093b6B96BA1) |
| WithdrawalHandler | `0x95E26343227D437Ad62b594C772828b77A966675` | [View on Explorer](https://sepolia.arbiscan.io/address/0x95E26343227D437Ad62b594C772828b77A966675) |
| WithdrawalStoreUtils | `0x152bb3B285BaF57bF4e761D99DEFC1548229B8EF` | [View on Explorer](https://sepolia.arbiscan.io/address/0x152bb3B285BaF57bF4e761D99DEFC1548229B8EF) |
| WithdrawalUtils | `0x3C0C9eAA33F696D8f89546Bb708085521015dabD` | [View on Explorer](https://sepolia.arbiscan.io/address/0x3C0C9eAA33F696D8f89546Bb708085521015dabD) |
| WithdrawalVault | `0x61a7C95B28eC4B3809D0DFb810A01D57bA7F8F68` | [View on Explorer](https://sepolia.arbiscan.io/address/0x61a7C95B28eC4B3809D0DFb810A01D57bA7F8F68) |
