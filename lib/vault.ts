import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
import { createPublicClient, http, encodeAbiParameters, toHex } from "viem";
import { uuidToLabel } from "@piplabs/cdr-sdk";

const STORY_RPC = process.env.NEXT_PUBLIC_STORY_RPC_URL || "https://aeneid.storyrpc.io";
let wasmInitPromise: Promise<void> | null = null;

export type VaultErrorCode = 
  | "WASM_INIT_FAILED"
  | "WALLET_REJECTED"
  | "UPLOAD_FAILED"
  | "VAULT_NOT_FOUND"
  | "DECRYPTION_FAILED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class VaultError extends Error {
  code: VaultErrorCode;
  userMessage: string;

  constructor(code: VaultErrorCode, userMessage: string, detail?: string) {
    super(detail || userMessage);
    this.code = code;
    this.userMessage = userMessage;
    this.name = "VaultError";
  }
}

function classifyError(err: unknown): VaultError {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  if (message.includes("wasm") || message.includes("initwasm")) {
    return new VaultError("WASM_INIT_FAILED", "Failed to initialize the encryption module. Please refresh and try again.");
  }
  if (message.includes("user rejected") || message.includes("user denied") || message.includes("rejected")) {
    return new VaultError("WALLET_REJECTED", "Transaction was rejected in your wallet.");
  }
  if (message.includes("vault not found") || message.includes("not found") || message.includes("404")) {
    return new VaultError("VAULT_NOT_FOUND", "Your vault was not found on-chain. It may not have been sealed properly.");
  }
  if (message.includes("timeout") || message.includes("network") || message.includes("fetch") || message.includes("econnrefused")) {
    return new VaultError("NETWORK_ERROR", "Network request timed out. Check your connection and try again.");
  }
  if (message.includes("upload") || message.includes("uploadcdr")) {
    return new VaultError("UPLOAD_FAILED", "Failed to seal your terms on-chain. Please try again.");
  }
  if (message.includes("decrypt") || message.includes("accesscdr") || message.includes("cipher")) {
    return new VaultError("DECRYPTION_FAILED", "Failed to decrypt the terms. The vault data may be corrupted.");
  }

  const detail = err instanceof Error ? err.message : String(err);
  return new VaultError("UNKNOWN", `Unexpected error: ${detail}`);
}

async function ensureWasm() {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm().catch((err) => {
      wasmInitPromise = null;
      throw classifyError(err);
    });
  }
  await wasmInitPromise;
}

// Fixed: Pass the functional publicClient into the builder
function buildCDRClient(walletClient: any, publicClient?: any) {
  const activePublicClient = publicClient || createPublicClient({
    transport: http(STORY_RPC),
  });

  return new CDRClient({
    network: "testnet",
    publicClient: activePublicClient,
    walletClient,
    apiUrl: "/api/cdr",
  });
}

function validateTerms(terms: any): void {
  if (!terms || typeof terms !== 'object') {
    throw new VaultError("UNKNOWN", "Invalid terms: must be an object");
  }

  const requiredFields = ['royaltySplit', 'deliverable', 'timeline', 'payment', 'nonNegotiable'];
  for (const field of requiredFields) {
    if (!(field in terms)) {
      throw new VaultError("UNKNOWN", `Invalid terms: missing required field '${field}'`);
    }
  }

  if (typeof terms.royaltySplit !== 'number' || terms.royaltySplit < 0 || terms.royaltySplit > 100) {
    throw new VaultError("UNKNOWN", "Invalid terms: royaltySplit must be a number between 0 and 100");
  }

  if (typeof terms.deliverable !== 'string' || terms.deliverable.length > 1000) {
    throw new VaultError("UNKNOWN", "Invalid terms: deliverable must be a string under 1000 characters");
  }

  if (typeof terms.timeline !== 'string' || terms.timeline.length > 100) {
    throw new VaultError("UNKNOWN", "Invalid terms: timeline must be a string under 100 characters");
  }

  if (typeof terms.payment !== 'number' || terms.payment < 0) {
    throw new VaultError("UNKNOWN", "Invalid terms: payment must be a non-negative number");
  }

  if (typeof terms.nonNegotiable !== 'string' || terms.nonNegotiable.length > 500) {
    throw new VaultError("UNKNOWN", "Invalid terms: nonNegotiable must be a string under 500 characters");
  }
}

// ── internal: shared seal logic ──────────────────────────────────────────────
async function _sealVault(
  terms: object,
  walletClient: any,
  publicClient: any,
  counterpartyAddress: `0x${string}`
): Promise<{ uuid: string }> {
  const client = buildCDRClient(walletClient, publicClient);

  const userAddress = walletClient.account?.address || walletClient.addresses?.[0];
  if (!userAddress) {
    throw new VaultError("UNKNOWN", "Wallet account address could not be resolved.");
  }

  const globalPubKey = await client.observer.getGlobalPubKey();
  const termsJson = JSON.stringify(terms);
  const dataKey = new TextEncoder().encode(termsJson);
  const writeConditionData = encodeAbiParameters([{ type: "address" }], [userAddress]);

  const { uuid } = await client.uploader.allocate({
    updatable: false,
    writeConditionAddr: "0x4C9bFC96d7092b590D497A191826C3dA2277c34B" as `0x${string}`,
    writeConditionData,
    readConditionAddr: counterpartyAddress,
    readConditionData: "0x",
    skipConditionValidation: true,
  });

  const label = uuidToLabel(uuid);
  const ciphertext = await client.uploader.encryptDataKey({ dataKey, globalPubKey, label });

  await client.uploader.write({
    uuid,
    accessAuxData: "0x",
    encryptedData: toHex(ciphertext.raw),
  });

  console.log("[vault] sealed vault uuid:", uuid);
  return { uuid: uuid.toString() };
}

// ── public exports ────────────────────────────────────────────────────────────
export async function sealTermsVault(
  terms: object,
  walletClient: any,
  publicClient: any,
  counterpartyAddress: `0x${string}`
): Promise<{ uuid: string; encryptedData: string }> {
  await ensureWasm();
  validateTerms(terms);
  try {
    const { uuid } = await _sealVault(terms, walletClient, publicClient, counterpartyAddress);
    return { uuid, encryptedData: "" };
  } catch (err) {
    console.error("[vault] raw error on seal:", err);
    throw err instanceof VaultError ? err : classifyError(err);
  }
}

export async function resubmitTermsVault(
  terms: object,
  walletClient: any,
  publicClient: any,
  counterpartyAddress: `0x${string}`
): Promise<{ uuid: string }> {
  await ensureWasm();
  validateTerms(terms);
  try {
    const { uuid } = await _sealVault(terms, walletClient, publicClient, counterpartyAddress);
    return { uuid };
  } catch (err) {
    console.error("[vault] raw error on resubmit:", err);
    throw err instanceof VaultError ? err : classifyError(err);
  }
}
export async function revealTermsVault(
  uuid: string,
  encryptedData: string,
  walletClient: any,
  publicClient: any
): Promise<object> {
  await ensureWasm();
  const client = buildCDRClient(walletClient, publicClient);
  const uuidNum = parseInt(uuid, 10);

 try {
    const result = await client.consumer.accessCDR({
      uuid: uuidNum,
      accessAuxData: "0x",
    });
    const recovered = result.dataKey;

    const termsJson = new TextDecoder().decode(recovered);
    console.log("[vault] revealed terms:", termsJson);
    return JSON.parse(termsJson);
  } catch (err) {
    console.error("[vault] raw error on reveal:", err);
    throw err instanceof VaultError ? err : classifyError(err);
  }
}