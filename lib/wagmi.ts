"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { http } from "wagmi";

export const storyAeneidTestnet = defineChain({
  id: 1315,
  name: "Story Aeneid Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "IP",
    symbol: "IP",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_STORY_RPC_URL || "https://aeneid.storyrpc.io"],
    },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: "Deal Room",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [storyAeneidTestnet],
  transports: {
    [storyAeneidTestnet.id]: http(process.env.NEXT_PUBLIC_STORY_RPC_URL || "https://aeneid.storyrpc.io"),
  },
  ssr: true,
});
