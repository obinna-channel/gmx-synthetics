// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../exchange/IDepositHandler.sol";
import "../deposit/IDepositUtils.sol";

contract DepositCreator {
    IDepositHandler public immutable depositHandler;

    constructor(IDepositHandler _depositHandler) {
        depositHandler = _depositHandler;
    }

    function createDeposit(
        IDepositUtils.CreateDepositParams calldata params
    ) external returns (bytes32) {
        // Forward the call to depositHandler
        return depositHandler.createDeposit(
            msg.sender,
            0, // srcChainId
            params
        );
    }
}