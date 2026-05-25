 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DealConfirmation {
    struct Deal {
        bool creatorConfirmed;
        bool joinerConfirmed;
        address creatorAddress;
        address joinerAddress;
        uint256 confirmedAt;
    }

    mapping(string => Deal) public deals;

    event DealConfirmed(string roomId, address confirmedBy);
    event DealSealed(string roomId, address creator, address joiner, uint256 timestamp);

    function confirmDeal(
        string calldata roomId,
        address creator,
        address joiner
    ) external {
        Deal storage deal = deals[roomId];

        require(
            msg.sender == creator || msg.sender == joiner,
            "Not a party to this deal"
        );
        require(!deal.creatorConfirmed || !deal.joinerConfirmed, "Deal already sealed");

        deal.creatorAddress = creator;
        deal.joinerAddress = joiner;

        if (msg.sender == creator) {
            require(!deal.creatorConfirmed, "Already confirmed");
            deal.creatorConfirmed = true;
        } else {
            require(!deal.joinerConfirmed, "Already confirmed");
            deal.joinerConfirmed = true;
        }

        emit DealConfirmed(roomId, msg.sender);

        if (deal.creatorConfirmed && deal.joinerConfirmed) {
            deal.confirmedAt = block.timestamp;
            emit DealSealed(roomId, creator, joiner, block.timestamp);
        }
    }

    function getDealStatus(string calldata roomId) external view returns (
        bool creatorConfirmed,
        bool joinerConfirmed,
        bool fullySealed,
        uint256 confirmedAt
    ) {
        Deal storage deal = deals[roomId];
        return (
            deal.creatorConfirmed,
            deal.joinerConfirmed,
            deal.creatorConfirmed && deal.joinerConfirmed,
            deal.confirmedAt
        );
    }
}