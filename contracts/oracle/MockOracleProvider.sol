// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IOracleProvider.sol";
import "./OracleUtils.sol";
import "../price/Price.sol";

/**
 * @title MockOracleProvider
 * @dev Simple oracle provider for testing that returns preset prices
 */
contract MockOracleProvider is IOracleProvider {
    using Price for Price.Props;

    mapping(address => Price.Props) public prices;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "MockOracleProvider: only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function getOraclePrice(
        address token,
        bytes memory /* data */
    ) external view returns (OracleUtils.ValidatedPrice memory) {
        Price.Props memory price = prices[token];
        require(price.min > 0 && price.max > 0, "MockOracleProvider: price not set");

        return OracleUtils.ValidatedPrice({
            token: token,
            min: price.min,
            max: price.max,
            timestamp: block.timestamp,
            provider: address(this)
        });
    }

    function shouldAdjustTimestamp() external pure returns (bool) {
        return false;
    }

    function isChainlinkOnChainProvider() external pure returns (bool) {
        return false;
    }

    function setPrice(address token, uint256 minPrice, uint256 maxPrice) external onlyOwner {
        prices[token] = Price.Props({
            min: minPrice,
            max: maxPrice
        });
    }

    function setPriceWithPrecision(address token, uint256 price) external onlyOwner {
        prices[token] = Price.Props({
            min: price,
            max: price
        });
    }
}