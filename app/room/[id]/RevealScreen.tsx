"use client";

import { useState, useEffect } from "react";
import { revealTermsVault, VaultError } from "@/lib/vault";
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { DEAL_CONFIRMATION_ADDRESS, DEAL_CONFIRMATION_ABI } from "@/lib/contract";
import { supabase } from "@/lib/supabase";

type Terms = {
  royaltySplit: number;
  deliverable: string;
  timeline: string;
  payment: number;
  nonNegotiable: string;
};

export default function RevealScreen({
  creatorVaultUuid,
  joinerVaultUuid,
  creatorEncryptedData,
  joinerEncryptedData,
  userRole,
  walletClient,
  publicClient,
  ownTerms,
  roomId,
  creatorAddress,
  joinerAddress,
}: {
  creatorVaultUuid: string;
  joinerVaultUuid: string;
  creatorEncryptedData: string;
  joinerEncryptedData: string;
  userRole: "creator" | "joiner";
  walletClient: any;
  publicClient: any;
  ownTerms: object | null;
  roomId: string;
  creatorAddress: string;
  joinerAddress: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetryable, setIsRetryable] = useState(true);
  const [myTerms, setMyTerms] = useState<Terms | null>(null);
  const [theirTerms, setTheirTerms] = useState<Terms | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`txHash_${roomId}`);
    if (stored) setTxHash(stored);
  }, [roomId]);

  useEffect(() => {
    if (ownTerms) return;
    async function fetchOwnTerms() {
      try {
        const { data } = await supabase
          .from("rooms")
          .select("creator_terms, joiner_terms")
          .eq("id", roomId)
          .single();
        if (!data) return;
        const terms = userRole === "creator" ? data.creator_terms : data.joiner_terms;
        if (terms) {
          const parsed = JSON.parse(terms);
          localStorage.setItem(`ownTerms_${roomId}`, terms);
        }
      } catch {
        // silent
      }
    }
    fetchOwnTerms();
  }, [roomId, ownTerms, userRole]);

  useEffect(() => {
    if (txHash) return;
    async function fetchTxFromStoryscan() {
      try {
        const res = await fetch(
          `https://aeneid.storyscan.io/api/v2/addresses/${DEAL_CONFIRMATION_ADDRESS}/transactions?filter=to`
        );
        const json = await res.json();
        if (!json.items) return;
        const match = json.items.find((tx: any) => {
          if (!tx.decoded_input?.parameters) return false;
          return tx.decoded_input.parameters.some(
            (p: any) => p.name === "roomId" && p.value === roomId
          );
        });
        if (match) {
          setTxHash(match.hash);
          localStorage.setItem(`txHash_${roomId}`, match.hash);
        }
      } catch {
        // silent
      }
    }
    fetchTxFromStoryscan();
  }, [roomId, txHash]);

  const { writeContractAsync, isPending: isConfirming } = useWriteContract();

  const { data: dealStatus, refetch: refetchStatus } = useReadContract({
    address: DEAL_CONFIRMATION_ADDRESS as `0x${string}`,
    abi: DEAL_CONFIRMATION_ABI,
    functionName: "getDealStatus",
    args: [roomId],
    query: { enabled: revealed, refetchInterval: 3000 },
  });

  const creatorSigned = Array.isArray(dealStatus) ? Boolean(dealStatus[0]) : false;
  const joinerSigned = Array.isArray(dealStatus) ? Boolean(dealStatus[1]) : false;
  const bothSigned = creatorSigned && joinerSigned;

  async function handleConfirmDeal() {
    setConfirmError(null);
    try {
      const hash = await writeContractAsync({
        address: DEAL_CONFIRMATION_ADDRESS as `0x${string}`,
        abi: DEAL_CONFIRMATION_ABI,
        functionName: "confirmDeal",
        args: [roomId, creatorAddress as `0x${string}`, joinerAddress as `0x${string}`],
      });
      setTxHash(hash);
      localStorage.setItem(`txHash_${roomId}`, hash);
      setConfirmed(true);
      await refetchStatus();
    } catch (e: any) {
      setConfirmError(e?.message?.includes("Already confirmed")
        ? "You have already signed this agreement."
        : "Failed to confirm. Please try again.");
    }
  }

async function handleReveal() {
  setIsRevealing(true);
  setError(null);
  try {
    if (userRole === "creator") {
      // Creator can only read joiner's vault
      const joinerTerms = await revealTermsVault(
        joinerVaultUuid,
        joinerEncryptedData,
        walletClient,
        publicClient
      ) as Terms;
      setTheirTerms(joinerTerms);
      const storedTerms = localStorage.getItem(`ownTerms_${roomId}`);
const localTerms = storedTerms ? JSON.parse(storedTerms) : null;
setMyTerms((ownTerms || localTerms) as Terms);
    } else {
      // Joiner can only read creator's vault
      const creatorTerms = await revealTermsVault(
        creatorVaultUuid,
        creatorEncryptedData,
        walletClient,
        publicClient
      ) as Terms;
      setTheirTerms(creatorTerms);
      const storedTerms = localStorage.getItem(`ownTerms_${roomId}`);
const localTerms = storedTerms ? JSON.parse(storedTerms) : null;
setMyTerms((ownTerms || localTerms) as Terms);
    }
    setRevealed(true);
  } catch (e) {
    if (e instanceof VaultError) {
      setError(e.userMessage);
      setIsRetryable(e.code !== "VAULT_NOT_FOUND" && e.code !== "DECRYPTION_FAILED");
    } else {
      setError("An unexpected error occurred. Please try again.");
      setIsRetryable(true);
    }
  } finally {
    setIsRevealing(false);
  }
}
  function handleDownloadSummary() {
    if (!myTerms || !theirTerms) return;
    const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const compromise = {
      royalty: !royaltyMatch ? `${Math.round((myTerms.royaltySplit + theirTerms.royaltySplit) / 2)}% / ${100 - Math.round((myTerms.royaltySplit + theirTerms.royaltySplit) / 2)}%` : null,
      payment: !paymentMatch ? `$${Math.round((myTerms.payment + theirTerms.payment) / 2)}` : null,
      timeline: !timelineMatch ? new Date((new Date(myTerms.timeline).getTime() + new Date(theirTerms.timeline).getTime()) / 2).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null,
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Deal Room Summary — ${roomId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; padding: 48px; font-size: 14px; }
          h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
          .meta { color: #666; font-size: 12px; margin-bottom: 32px; }
          .section { margin-bottom: 28px; }
          .section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #888; padding: 6px 10px; border-bottom: 2px solid #eee; }
          td { padding: 10px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
          .badge-match { background: #d1fae5; color: #065f46; font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 500; }
          .badge-gap { background: #fef3c7; color: #92400e; font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 500; }
          .summary-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
          .summary-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
          .summary-row:last-child { border-bottom: none; }
          .label { color: #666; }
          .value { font-weight: 600; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
          .aligned { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
          @media print { body { padding: 32px; } }
        </style>
      </head>
      <body>
        <h1>Deal Room Summary</h1>
        <p class="meta">Room ID: ${roomId} &nbsp;·&nbsp; Generated: ${now}</p>

        <div class="section">
          <p class="section-title">Parties</p>
          <div class="summary-box">
            <div class="summary-row"><span class="label">Creator</span><span class="value">${creatorAddress}</span></div>
            <div class="summary-row"><span class="label">Counterparty</span><span class="value">${joinerAddress}</span></div>
          </div>
        </div>

        <div class="section">
          <p class="section-title">Terms Comparison</p>
          <table>
            <thead><tr><th>Field</th><th>Your Terms</th><th>Their Terms</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>Royalty Split</td><td>${myTerms.royaltySplit}%</td><td>${theirTerms.royaltySplit}%</td><td><span class="${royaltyMatch ? 'badge-match' : 'badge-gap'}">${royaltyMatch ? 'Close match' : 'Gap'}</span></td></tr>
              <tr><td>Deliverable</td><td>${myTerms.deliverable}</td><td>${theirTerms.deliverable}</td><td><span class="${deliverableMatch ? 'badge-match' : 'badge-gap'}">${deliverableMatch ? 'Close match' : 'Gap'}</span></td></tr>
              <tr><td>Timeline</td><td>${myTerms.timeline}</td><td>${theirTerms.timeline}</td><td><span class="${timelineMatch ? 'badge-match' : 'badge-gap'}">${timelineMatch ? 'Close match' : 'Gap'}</span></td></tr>
              <tr><td>Payment</td><td>$${myTerms.payment}</td><td>$${theirTerms.payment}</td><td><span class="${paymentMatch ? 'badge-match' : 'badge-gap'}">${paymentMatch ? 'Close match' : 'Gap'}</span></td></tr>
              <tr><td>Non-negotiable</td><td>${myTerms.nonNegotiable}</td><td>${theirTerms.nonNegotiable}</td><td><span class="${nonNegotiableMatch ? 'badge-match' : 'badge-gap'}">${nonNegotiableMatch ? 'Close match' : 'Gap'}</span></td></tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <p class="aligned">${alignedCount} / 5 fields aligned</p>
          ${compromise.royalty || compromise.payment || compromise.timeline ? `
          <p class="section-title" style="margin-top:16px;">Suggested Compromise</p>
          <div class="summary-box">
            ${compromise.royalty ? `<div class="summary-row"><span class="label">Royalty split</span><span class="value">${compromise.royalty}</span></div>` : ''}
            ${compromise.payment ? `<div class="summary-row"><span class="label">Upfront payment</span><span class="value">${compromise.payment}</span></div>` : ''}
            ${compromise.timeline ? `<div class="summary-row"><span class="label">Timeline</span><span class="value">${compromise.timeline}</span></div>` : ''}
          </div>` : ''}
        </div>

        <div class="section">
          <p class="section-title">Onchain Agreement</p>
          <div class="summary-box">
            <div class="summary-row"><span class="label">Creator</span><span class="value">${creatorSigned ? '✓ Signed' : 'Pending'}</span></div>
            <div class="summary-row"><span class="label">Counterparty</span><span class="value">${joinerSigned ? '✓ Signed' : 'Pending'}</span></div>
          </div>
        </div>

        <div class="footer">
          <p>Terms sealed via Confidential Data Rails (CDR) on Story Protocol · dealroom-red.vercel.app</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  }

  function matchBadge(isMatch: boolean) {
    return isMatch ? (
      <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded-full">Close match</span>
    ) : (
      <span className="text-xs bg-yellow-900 text-yellow-400 px-2 py-1 rounded-full">Gap</span>
    );
  }

  const royaltyMatch = myTerms && theirTerms
    ? myTerms.royaltySplit + theirTerms.royaltySplit >= 90 && myTerms.royaltySplit + theirTerms.royaltySplit <= 110
    : false;

  const paymentMatch = myTerms && theirTerms
    ? Math.abs(myTerms.payment - theirTerms.payment) / (Math.max(myTerms.payment, theirTerms.payment) || 1) <= 0.3
    : false;

  const deliverableMatch = myTerms && theirTerms
    ? myTerms.deliverable.toLowerCase() === theirTerms.deliverable.toLowerCase()
    : false;

  const timelineMatch = myTerms && theirTerms
    ? myTerms.timeline === theirTerms.timeline
    : false;

  const nonNegotiableMatch = myTerms && theirTerms
    ? myTerms.nonNegotiable.toLowerCase() === theirTerms.nonNegotiable.toLowerCase()
    : false;

  const alignedCount = [
    royaltyMatch,
    paymentMatch,
    deliverableMatch,
    timelineMatch,
    nonNegotiableMatch,
  ].filter(Boolean).length;

  if (!revealed) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-white font-medium">Both terms are sealed and ready.</p>

        {error && (
          <div className="flex flex-col gap-3 w-full rounded-lg bg-red-900/30 border border-red-800/50 px-4 py-3">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-400 text-sm leading-relaxed">{error}</span>
            </div>
            {isRetryable && (
              <button
                onClick={handleReveal}
                className="self-start rounded-md bg-red-800/50 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-700/50 transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleReveal}
          disabled={isRevealing}
          className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-60 transition-colors"
        >
          {isRevealing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Decrypting terms...
            </span>
          ) : (
            "Reveal Both Terms"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col gap-3 bg-gray-800 rounded-lg p-4">
  <div className="flex justify-between items-center mb-2">
    <span className="text-xs text-gray-400 uppercase tracking-wide w-1/3">Field</span>
    <span className="text-xs text-green-400 uppercase tracking-wide w-1/3 text-center">Your Terms</span>
    <span className="text-xs text-blue-400 uppercase tracking-wide w-1/3 text-right">Their Terms</span>
  </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-700">
          <span className="text-sm text-white w-1/3">Royalty Split</span>
          <span className="text-sm text-white w-1/3 text-center">{myTerms?.royaltySplit}%</span>
          <span className="text-sm text-white w-1/3 text-right">{theirTerms?.royaltySplit}%</span>
          <span className="w-1/4 text-right">{matchBadge(royaltyMatch)}</span>
        </div>
          

        <div className="flex justify-between items-center py-2 border-b border-gray-700">
          <span className="text-sm text-white w-1/3">Deliverable</span>
          <span className="text-sm text-white w-1/4 text-center truncate" title={myTerms?.deliverable ?? ""}>{myTerms?.deliverable}</span>
          <span className="text-sm text-white w-1/4 text-right truncate" title={theirTerms?.deliverable ?? ""}>{theirTerms?.deliverable}</span>
          <span className="w-1/4 text-right">{matchBadge(deliverableMatch)}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-700">
          <span className="text-sm text-white w-1/3">Timeline</span>
          <span className="text-sm text-white w-1/3 text-center">{myTerms?.timeline}</span>
          <span className="text-sm text-white w-1/3 text-right">{theirTerms?.timeline}</span>
          <span className="w-1/4 text-right">{matchBadge(timelineMatch)}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-700">
          <span className="text-sm text-white w-1/3">Payment</span>
          <span className="text-sm text-white w-1/3 text-center">${myTerms?.payment}</span>
          <span className="text-sm text-white w-1/3 text-right">${theirTerms?.payment}</span>
                  <span className="w-1/4 text-right">{matchBadge(paymentMatch)}</span>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-700">
          <span className="text-sm text-white w-1/3">Non-negotiable</span>
          <span className="text-sm text-white w-1/4 text-center truncate" title={myTerms?.nonNegotiable ?? ""}>{myTerms?.nonNegotiable}</span>
          <span className="text-sm text-white w-1/4 text-right truncate" title={theirTerms?.nonNegotiable ?? ""}>{theirTerms?.nonNegotiable}</span>
          <span className="w-1/4 text-right">{matchBadge(nonNegotiableMatch)}</span>
        </div>
      </div>

      <div className="rounded-lg bg-gray-900 px-4 py-3 text-center">
        <p className="text-white text-sm font-medium">{alignedCount} out of 5 fields aligned</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span>{creatorSigned ? "✅" : "⏳"}</span>
            <span>Creator</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Counterparty</span>
            <span>{joinerSigned ? "✅" : "⏳"}</span>
          </div>
        </div>

        {bothSigned ? (
          <div className="w-full rounded-lg bg-green-900/30 border border-green-800/50 px-4 py-3 text-center flex flex-col gap-1">
            <p className="text-green-400 text-sm font-medium">🔒 Deal sealed onchain by both parties</p>
            {txHash && (
              <a
                href={`https://aeneid.storyscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 text-xs underline hover:text-green-400 transition-colors"
              >
                View transaction on Storyscan →
              </a>
            )}
          </div>
        ) : confirmed ? (
          <div className="w-full rounded-lg bg-green-900/30 border border-green-800/50 px-4 py-3 text-center">
            <p className="text-green-400 text-sm font-medium">✓ You have signed the agreement onchain</p>
            <p className="text-green-600 text-xs mt-1">Waiting for the other party to sign</p>
          </div>
        ) : (
          <button
            onClick={handleConfirmDeal}
            disabled={isConfirming}
            className="w-full rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {isConfirming ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing...
              </span>
            ) : (
              "Sign Agreement Onchain"
            )}
          </button>
        )}
        {confirmError && <p className="text-red-400 text-xs text-center">{confirmError}</p>}
      </div>

      {myTerms && theirTerms && alignedCount < 5 && (
        <div className="flex flex-col gap-3 bg-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Suggested Compromise</p>

          {!royaltyMatch && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Royalty split</span>
              <span className="text-white font-medium">
                {Math.round((myTerms.royaltySplit + theirTerms.royaltySplit) / 2)}% / {100 - Math.round((myTerms.royaltySplit + theirTerms.royaltySplit) / 2)}%
              </span>
            </div>
          )}

          {!paymentMatch && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Upfront payment</span>
              <span className="text-white font-medium">
                ${Math.round((myTerms.payment + theirTerms.payment) / 2)}
              </span>
            </div>
          )}

          {!timelineMatch && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Timeline</span>
              <span className="text-white font-medium">
                {new Date(
                  (new Date(myTerms.timeline).getTime() + new Date(theirTerms.timeline).getTime()) / 2
                ).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          )}

          {!deliverableMatch && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Deliverable</span>
              <span className="text-gray-400 text-xs italic">Needs direct discussion</span>
            </div>
          )}

          {!nonNegotiableMatch && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Non-negotiable</span>
              <span className="text-gray-400 text-xs italic">Needs direct discussion</span>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-1">These are calculated midpoints. Both parties must agree to proceed.</p>
        </div>
      )}
       
    <button
        onClick={handleDownloadSummary}
        className="w-full rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        Download Deal Summary
      </button>
    </div>
  );
}