"use strict";

require("dotenv").config({ path: ".env.local" });
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing DEPLOYER_PRIVATE_KEY");

  const provider = new ethers.JsonRpcProvider("https://aeneid.storyrpc.io");
  const wallet = new ethers.Wallet(`0x${privateKey}`, provider);
  console.log("Deploying from:", wallet.address);

  const artifactPath = path.join(__dirname, "../artifacts/contracts/DealConfirmation.sol/DealConfirmation.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log("DealConfirmation deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});