process.env.TS_NODE_PROJECT = "tsconfig.hardhat.json";
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-ignition-viem";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    storyAeneid: {
      url: "https://aeneid.storyrpc.io",
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
      chainId: 1315,
    },
  },
};

export default config;