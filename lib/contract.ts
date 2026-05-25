export const DEAL_CONFIRMATION_ADDRESS = "0xDe9EcCA931CB8d98577d982e2DE11BbF20B8b934";

export const DEAL_CONFIRMATION_ABI = [
  {
    inputs: [
      { internalType: "string", name: "roomId", type: "string" },
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "address", name: "joiner", type: "address" },
    ],
    name: "confirmDeal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "roomId", type: "string" }],
    name: "getDealStatus",
    outputs: [
      { internalType: "bool", name: "creatorConfirmed", type: "bool" },
      { internalType: "bool", name: "joinerConfirmed", type: "bool" },
      { internalType: "bool", name: "fullySealed", type: "bool" },
      { internalType: "uint256", name: "confirmedAt", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;