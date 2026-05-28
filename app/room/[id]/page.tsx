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
  const [notFound, setNotFound] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);
  const [ownTerms, setOwnTerms] = useState<object | null>(null);
  const [ownTermsReady, setOwnTermsReady] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingTerms, setPendingTerms] = useState<object | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`ownTerms_${id}`);
    if (stored) setOwnTerms(JSON.parse(stored));
    setOwnTermsReady(true);
  }, [id]);

  async function fetchRoom() {
    try {
      const data = await getRoom(id);
      if (!data) setNotFound(true);
      else setRoom(data);
    } catch {
      setNotFound(true);
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

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  function handleCopyId() {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  function handleTermsPreSubmit(terms: object) {
    setPendingTerms(terms);
    setShowConfirm(true);
  }

  function handleConfirmSeal() {
    setShowConfirm(false);
    if (pendingTerms) handleTermsSubmit(pendingTerms);
  }

  function handleCancelSeal() {
    setShowConfirm(false);
    setPendingTerms(null);
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
      await updateVault(id, role, uuid, encryptedData, JSON.stringify(terms));
      setOwnTerms(terms);
      localStorage.setItem(`ownTerms_${id}`, JSON.stringify(terms));
      setHasSubmitted(true);
      fetchRoom();
    } catch (e) {
      console.error("[handleTermsSubmit] error:", e);
      if (e instanceof VaultError) setSealError(e.userMessage);
      else setSealError("Failed to seal your terms. Please try again.");
    } finally {
      setIsSealing(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-6 w-6 text-[#7C72F5]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-white/30 text-sm">Loading room...</p>
        </div>
      </main>
    );
  }

  // ── Not found ────────────────────────────────────────────────
  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-page px-6 text-center">
        <div className="gloss-panel w-full max-w-sm p-8 flex flex-col items-center gap-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl gloss-panel border border-white/[0.08]">
            <svg className="w-7 h-7 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-white font-semibold text-lg">Room not found</p>
            <p className="text-white/35 text-sm max-w-xs">This deal room doesn&apos;t exist or may have expired. Double-check the link or ID.</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-[#7C72F5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6457E8] transition-colors glow-accent"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  // ── Cancelled ────────────────────────────────────────────────
  if (room?.status === "cancelled") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-page px-6 text-center">
        <div className="gloss-panel w-full max-w-sm p-8 flex flex-col items-center gap-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl gloss-panel border border-white/[0.08]">
            <svg className="w-7 h-7 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-white font-semibold text-lg">Deal room cancelled</p>
            <p className="text-white/35 text-sm max-w-xs">This deal room was cancelled by the creator. No terms were exchanged.</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-[#7C72F5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6457E8] transition-colors glow-accent"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────
  if (!isConnected) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-page px-6">
        <div className="gloss-panel w-full max-w-sm px-8 py-10 flex flex-col items-center gap-5 text-center">
          <p className="text-white/40 text-sm">Connect your wallet to continue</p>
          <ConnectButton />
        </div>
      </main>
    );
  }

  const isCreator = address === room?.creator_address;
  const joinerHasJoined = !!room?.joiner_address;
  const bothCommitted = room?.status === "both_committed";

  // ── Main room ────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-page px-6 py-12">

      {/* Header */}
      <div className="w-full max-w-lg flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-white/25 hover:text-white/50 transition-colors flex items-center gap-1"
          >
            ← Back to dashboard
          </button>
          <h1 className="text-2xl font-bold text-white">Room #{id}</h1>
        </div>
        <ConnectButton />
      </div>

      {/* Content */}
      <div className="w-full max-w-lg flex flex-col gap-5">

        {/* Status bar */}
        <div className="gloss-panel px-4 py-3 text-sm text-white/40">
          Status:{" "}
          <span className="text-white font-medium">
            {room?.status === "waiting" ? "Waiting for other party" :
             room?.status === "both_joined" ? "Both parties connected" :
             room?.status === "both_committed" ? "Terms sealed — ready to reveal" :
             room?.status}
          </span>
        </div>

        {/* Creator waiting for joiner */}
        {isCreator && !joinerHasJoined && (
          <div className="flex flex-col gap-4">
            <p className="text-white/40 text-sm">Waiting for the other party to join. Share this link:</p>
            <div className="gloss-panel px-4 py-3 text-sm text-white/60 break-all font-mono">
              {typeof window !== "undefined" ? window.location.href : ""}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCopyLink}
                className="flex-1 rounded-lg bg-[#7C72F5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6457E8] transition-colors glow-accent"
              >
                {copiedLink ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={handleCopyId}
                className="flex-1 gloss-panel px-4 py-2.5 text-sm font-semibold text-white/45 hover:text-white/75 transition-colors"
              >
                {copiedId ? "Copied!" : "Copy Room ID"}
              </button>
            </div>
          </div>
        )}

        {/* Joiner needs to join */}
        {!isCreator && !joinerHasJoined && (
          <div className="flex flex-col gap-4">
            <p className="text-white/40 text-sm">You have been invited to a Deal Room.</p>
            <button
              onClick={handleJoin}
              className="rounded-lg bg-[#7C72F5] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6457E8] transition-colors glow-accent"
            >
              Join this Deal Room
            </button>
          </div>
        )}

        {/* Both joined — terms form */}
        {joinerHasJoined && !bothCommitted && !hasSubmitted && (
          <div className="flex flex-col gap-4">
            <p className="text-white font-medium">Both parties connected. Submit your terms.</p>
            {sealError && (
              <div className="flex items-start gap-2 w-full gloss-panel border border-red-800/40 bg-red-900/10 px-4 py-3">
                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-400 text-sm leading-relaxed">{sealError}</span>
              </div>
            )}
            {isSealing ? (
              <div className="gloss-panel px-4 py-4 flex items-center gap-3">
                <svg className="animate-spin h-4 w-4 text-[#7C72F5] shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-white/40 text-sm">Sealing to the blockchain... You&apos;ll confirm twice in your wallet. Takes ~20 seconds.</p>
              </div>
            ) : (
              <TermsForm onSubmit={handleTermsPreSubmit} />
            )}
          </div>
        )}

        {/* Submitted, waiting for other party */}
        {joinerHasJoined && !bothCommitted && hasSubmitted && (
          <div className="gloss-panel px-4 py-4 flex items-center gap-3">
            <svg className="animate-spin h-4 w-4 text-[#7C72F5] shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-white/40 text-sm">Your terms are sealed. Waiting for the other party to submit theirs.</p>
          </div>
        )}

        {/* Both committed — reveal screen */}
        {bothCommitted && ownTermsReady && (
          <RevealScreen
            creatorVaultUuid={room.creator_vault_uuid}
            joinerVaultUuid={room.joiner_vault_uuid}
            creatorEncryptedData={room.creator_encrypted_data}
            joinerEncryptedData={room.joiner_encrypted_data}
            userRole={isCreator ? "creator" : "joiner"}
            walletClient={walletClient}
            publicClient={publicClient}
            ownTerms={ownTerms}
            roomId={id}
            creatorAddress={room.creator_address}
            joinerAddress={room.joiner_address}
          />
        )}
      </div>

      {/* Seal confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <div className="gloss-panel w-full max-w-sm p-6 flex flex-col gap-4">
            <h2 className="text-white font-semibold text-lg">Seal your terms?</h2>
            <p className="text-white/40 text-sm leading-relaxed">
              Your terms will be locked and encrypted to the blockchain.{" "}
              <span className="text-white/80">This cannot be undone.</span> Make sure everything looks right before confirming.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={handleCancelSeal}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white/45 hover:text-white/70 hover:bg-white/5 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmSeal}
                className="flex-1 rounded-lg bg-[#7C72F5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6457E8] transition-colors glow-accent"
              >
                Yes, Seal My Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}