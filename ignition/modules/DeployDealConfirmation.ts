import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DealConfirmationModule = buildModule("DealConfirmationModule", (m) => {
  const dealConfirmation = m.contract("DealConfirmation");
  return { dealConfirmation };
});

export default DealConfirmationModule;