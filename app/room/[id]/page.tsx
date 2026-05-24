"use client";

import { useParams } from "next/navigation";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRoom, joinRoom, updateVault } from "@/lib/rooms";
import { sealTermsVault, VaultError } from "@/lib/vault";
import TermsForm from "./TermsForm";
import RevealScreen from "./RevealScreen";

export default function RoomPage() {
  const params = useParams();
  const id = params.id as string;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const router = useRouter();
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);
   const [ownTerms, setOwnTerms] = useState<object | null>(null);
useEffect(() => {
  const stored = localStorage.getItem(`ownTerms_${id}`);
  console.log("[ownTerms] stored:", stored)
  if (stored) setOwnTerms(JSON.parse(stored));
}, [id]);

  async function fetchRoom() {
    try {
      const data = await getRoom(id);
      setRoom(data);
    } catch (e) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRoom();
    const interval = setInterval(fetchRoom, 3000);
    return () => clearInterval(interval);
  }, [id]);

  async function handleJoin() {
    if (!address) return;
    await joinRoom(id, address);
    fetchRoom();
  }

  async function handleTermsSubmit(terms: object) {
  if (!address || !walletClient || !publicClient) {
    setSealError("Wallet not ready. Please wait a moment and try again.");
    return;
  }
  setIsSealing(true);
  setSealError(null);
  try {
    const isCreator = address === room.creator_address;
   const counterparty = (isCreator ? room.joiner_address : room.creator_address) as `0x${string}`;
    const { uuid, encryptedData } = await sealTermsVault(terms, walletClient, publicClient, counterparty);
    const role = isCreator ? "creator" : "joiner";
    await updateVault(id, role, uuid, encryptedData);
    setOwnTerms(terms);
    localStorage.setItem(`ownTerms_${id}`, JSON.stringify(terms));
    setHasSubmitted(true);
    fetchRoom();
  } catch (e) {
    console.error("[handleTermsSubmit] error:", e);
    if (e instanceof VaultError) {
      setSealError(e.userMessage);
    } else {
      setSealError("Failed to seal your terms. Please try again.");
    }
  } finally {
    setIsSealing(false);
  }
}

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950">
        <p className="text-gray-400">Loading room...</p>
      </main>
    );
  }

  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950">
        <p className="text-gray-400">Connect your wallet to continue</p>
        <ConnectButton />
      </main>
    );
  }

  const isCreator = address === room?.creator_address;
  const joinerHasJoined = !!room?.joiner_address;
  const bothCommitted = room?.status === "both_committed";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-950 px-6 py-12">
      <div className="w-full max-w-lg flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            ← Back to dashboard
          </button>
          <h1 className="text-2xl font-bold text-white">Room #{id}</h1>
        </div>
        <ConnectButton />
      </div>

      <div className="w-full max-w-lg">
        <div className="mb-6 rounded-lg bg-gray-800 px-4 py-3 text-sm text-gray-400">
      Status: <span className="text-white font-medium">
      {room?.status === "waiting" ? "Waiting for other party" :
      room?.status === "both_joined" ? "Both parties connected" :
      room?.status === "both_committed" ? "Terms sealed. Ready to reveal" :
      room?.status}
      </span>
      </div>

        {/* Creator waiting for joiner */}
        {isCreator && !joinerHasJoined && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">Waiting for the other party to join. Share this link:</p>
            <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm text-white break-all">
              {typeof window !== "undefined" ? window.location.href : ""}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-200"
              >
                Copy Link
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(id)}
                className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Copy Room ID
              </button>
            </div>
          </div>
        )}

        {/* Joiner needs to join */}
        {!isCreator && !joinerHasJoined && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-sm">You have been invited to a Deal Room.</p>
            <button
              onClick={handleJoin}
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-200"
            >
              Join this Deal Room
            </button>
          </div>
        )}

        {/* Both joined — show terms form */}
        {joinerHasJoined && !bothCommitted && !hasSubmitted && (
          <div className="flex flex-col gap-4">
            <p className="text-white font-medium">Both parties connected. Submit your terms.</p>
            {sealError && (
              <div className="flex items-start gap-2 w-full rounded-lg bg-red-900/30 border border-red-800/50 px-4 py-3">
                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-400 text-sm leading-relaxed">{sealError}</span>
              </div>
            )}
            {isSealing ? (
              <p className="text-gray-400 text-sm">Sealing your terms to the blockchain... this takes about 20 seconds.</p>
            ) : (
              <TermsForm onSubmit={handleTermsSubmit} />
            )}
          </div>
        )}

        {/* User submitted, waiting for other party */}
        {joinerHasJoined && !bothCommitted && hasSubmitted && (
          <p className="text-gray-400 text-sm">Your terms are sealed. Waiting for the other party to submit theirs.</p>
        )}

       {/* Both committed — reveal screen */}
       {bothCommitted && (
          <RevealScreen
            creatorVaultUuid={room.creator_vault_uuid}
            joinerVaultUuid={room.joiner_vault_uuid}
            creatorEncryptedData={room.creator_encrypted_data}
            joinerEncryptedData={room.joiner_encrypted_data}
            userRole={isCreator ? "creator" : "joiner"}
            walletClient={walletClient}
            publicClient={publicClient}
            ownTerms={ownTerms}
          />
        )}
      </div>
    </main>
  );
}