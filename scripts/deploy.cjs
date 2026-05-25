"use strict";

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const DealConfirmation = await hre.ethers.getContractFactory("DealConfirmation");
  const dealConfirmation = await DealConfirmation.deploy();
  await dealConfirmation.waitForDeployment();

  console.log("DealConfirmation deployed to:", await dealConfirmation.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});