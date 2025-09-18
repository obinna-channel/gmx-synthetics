// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../price/Price.sol";
import "../role/RoleModule.sol";
import "../data/DataStore.sol";
import "../event/EventEmitter.sol";

/**
 * @title MarksSimplifiedOracle
 * @dev Simplified Oracle for Marks Exchange
 * Implements the minimal interface that GMX contracts expect
 */
contract MarksSimplifiedOracle is RoleModule {
    using Price for Price.Props;
    
    // State variables required by GMX
    DataStore public immutable dataStore;
    EventEmitter public immutable eventEmitter;
    uint256 public minTimestamp;
    uint256 public maxTimestamp;
    
    // Token prices storage
    mapping(address => Price.Props) public primaryPrices;
    
    // Track tokens with prices
    address[] public tokensWithPrices;
    mapping(address => bool) public hasPrice;
    
    constructor(
        RoleStore _roleStore,
        DataStore _dataStore,
        EventEmitter _eventEmitter
    ) RoleModule(_roleStore) {
        dataStore = _dataStore;
        eventEmitter = _eventEmitter;
    }
    
    /**
     * @dev Core function that GMX contracts call to get prices
     * THIS IS THE CRITICAL FUNCTION FOR GMX COMPATIBILITY
     */
    function getPrimaryPrice(address token) external view returns (Price.Props memory) {
        if (token == address(0)) { 
            return Price.Props(0, 0); 
        }
        
        Price.Props memory price = primaryPrices[token];
        
        // GMX expects a revert if price is not set
        if (price.min == 0 || price.max == 0) {
            revert("EmptyPrimaryPrice");
        }
        
        return price;
    }
    
    /**
     * @dev Simple function to set prices - called by keeper
     * @param tokens Array of token addresses
     * @param minPrices Array of minimum prices (30 decimals)
     * @param maxPrices Array of maximum prices (30 decimals)
     */
    function setSimplePrices(
        address[] memory tokens,
        uint256[] memory minPrices,
        uint256[] memory maxPrices
    ) external onlyController {
        require(tokens.length == minPrices.length, "Length mismatch");
        require(tokens.length == maxPrices.length, "Length mismatch");
        require(tokens.length > 0, "No prices");
        
        // Clear old prices if needed
        if (tokensWithPrices.length > 0) {
            _clearAllPrices();
        }
        
        uint256 currentTimestamp = block.timestamp;
        minTimestamp = currentTimestamp;
        maxTimestamp = currentTimestamp;
        
        for (uint256 i = 0; i < tokens.length; i++) {
            require(minPrices[i] > 0, "Invalid min price");
            require(maxPrices[i] >= minPrices[i], "Invalid max price");
            
            primaryPrices[tokens[i]] = Price.Props(minPrices[i], maxPrices[i]);
            
            if (!hasPrice[tokens[i]]) {
                tokensWithPrices.push(tokens[i]);
                hasPrice[tokens[i]] = true;
            }
        }
    }
    
    /**
     * @dev Set a single price - useful for testing
     */
    function setPrimaryPrice(address token, Price.Props memory price) external onlyController {
        require(price.min > 0 && price.max > 0, "Invalid price");
        require(price.max >= price.min, "Max less than min");
        
        primaryPrices[token] = price;
        
        if (!hasPrice[token]) {
            tokensWithPrices.push(token);
            hasPrice[token] = true;
        }
        
        uint256 currentTimestamp = block.timestamp;
        minTimestamp = currentTimestamp;
        maxTimestamp = currentTimestamp;
    }
    
    /**
     * @dev Clear all prices
     */
    function clearAllPrices() external onlyController {
        _clearAllPrices();
    }
    
    function _clearAllPrices() internal {
        for (uint256 i = 0; i < tokensWithPrices.length; i++) {
            address token = tokensWithPrices[i];
            delete primaryPrices[token];
            delete hasPrice[token];
        }
        delete tokensWithPrices;
        minTimestamp = 0;
        maxTimestamp = 0;
    }
    
    /**
     * @dev Required by some GMX contracts
     */
    function validateSequencerUp() external view {
        // Not needed for testnet, just return
    }
    
    /**
     * @dev Get count of tokens with prices
     */
    function getTokensWithPricesCount() external view returns (uint256) {
        return tokensWithPrices.length;
    }
    
    /**
     * @dev Get tokens with prices in range
     */
    function getTokensWithPrices(uint256 start, uint256 end) external view returns (address[] memory) {
        require(end <= tokensWithPrices.length, "End out of bounds");
        require(start <= end, "Invalid range");
        
        address[] memory result = new address[](end - start);
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = tokensWithPrices[start + i];
        }
        return result;
    }
}