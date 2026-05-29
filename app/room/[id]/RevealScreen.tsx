"use client";

import { useState, useEffect } from "react";
import { revealTermsVault, VaultError } from "@/lib/vault";
import { useWriteContract, useReadContract } from "wagmi";
import { DEAL_CONFIRMATION_ADDRESS, DEAL_CONFIRMATION_ABI } from "@/lib/contract";
import { supabase } from "@/lib/supabase";
import ChatPanel from "@/components/ChatPanel";

type Terms = {
  royaltySplit: number;
  deliverable: string;
  timeline: string;
  payment: number;
  nonNegotiable: string;
};

// ── Timing constants ─────────────────────────────────────────────────────────
const ROW_START   = 480;   // ms after reveal: first row fades in
const ROW_GAP     = 90;    // ms between rows
const BADGE_START = ROW_START + 4 * ROW_GAP + 200; // after last row settles
const BADGE_GAP   = 80;    // ms between badges
const BTN_DELAY   = BADGE_START + 4 * BADGE_GAP + 300;
const COUNT_DELAY = BADGE_START + 4 * BADGE_GAP + 200;

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
  // ── Core state ───────────────────────────────────────────────
  const [revealed,    setRevealed]    = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [isRetryable, setIsRetryable] = useState(true);
  const [myTerms,     setMyTerms]     = useState<Terms | null>(null);
  const [theirTerms,  setTheirTerms]  = useState<Terms | null>(null);
  const [confirmError,setConfirmError]= useState<string | null>(null);
  const [confirmed,   setConfirmed]   = useState(false);
  const [txHash,      setTxHash]      = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");

  // ── Animation state ──────────────────────────────────────────
 const [isCountingDown, setIsCountingDown] = useState(false);
  const [cardRisen,      setCardRisen]      = useState(false);
  const [flareActive,    setFlareActive]    = useState(false);
  const [visibleRows,    setVisibleRows]    = useState<number[]>([]);
  const [visibleBadges,  setVisibleBadges]  = useState<number[]>([]);
  const [displayCount,   setDisplayCount]   = useState(0);
  const [buttonsReady,   setButtonsReady]   = useState(false);

  // ── Persisted tx hash ────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(`txHash_${roomId}`);
    if (stored) setTxHash(stored);
  }, [roomId]);

  // ── Fetch own terms if not passed ────────────────────────────
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
        if (terms) localStorage.setItem(`ownTerms_${roomId}`, terms);
      } catch { /* silent */ }
    }
    fetchOwnTerms();
  }, [roomId, ownTerms, userRole]);

  // ── Storyscan tx lookup ──────────────────────────────────────
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
      } catch { /* silent */ }
    }
    fetchTxFromStoryscan();
  }, [roomId, txHash]);

  // ── Card rise (tiny defer so DOM renders first) ──────────────
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(() => setCardRisen(true), 20);
    return () => clearTimeout(t);
  }, [revealed]);

  // ── Full stagger sequence once revealed ──────────────────────
  useEffect(() => {
    if (!revealed) return;
    setVisibleRows([]);
    setVisibleBadges([]);
    setDisplayCount(0);
    setButtonsReady(false);

    [0, 1, 2, 3, 4].forEach((i) =>
      setTimeout(() => setVisibleRows((p) => [...p, i]), ROW_START + i * ROW_GAP)
    );
    [0, 1, 2, 3, 4].forEach((i) =>
      setTimeout(() => setVisibleBadges((p) => [...p, i]), BADGE_START + i * BADGE_GAP)
    );
    setTimeout(() => setButtonsReady(true), BTN_DELAY);
  }, [revealed]);

  // ── Alignment counter after badges settle ────────────────────
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => {
      if (alignedCount === 0) return;
      let current = 0;
      const interval = setInterval(() => {
        current += 1;
        setDisplayCount(current);
        if (current >= alignedCount) clearInterval(interval);
      }, 120);
    }, COUNT_DELAY);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  // ── Wagmi ────────────────────────────────────────────────────
  const { writeContractAsync, isPending: isConfirming } = useWriteContract();
  const { data: dealStatus, refetch: refetchStatus } = useReadContract({
    address: DEAL_CONFIRMATION_ADDRESS as `0x${string}`,
    abi: DEAL_CONFIRMATION_ABI,
    functionName: "getDealStatus",
    args: [roomId],
    query: { enabled: revealed, refetchInterval: 3000 },
  });

  const creatorSigned = Array.isArray(dealStatus) ? Boolean(dealStatus[0]) : false;
  const joinerSigned  = Array.isArray(dealStatus) ? Boolean(dealStatus[1]) : false;
  const bothSigned    = creatorSigned && joinerSigned;

  // ── Derived match values ─────────────────────────────────────
  const royaltyMatch = myTerms && theirTerms
    ? myTerms.royaltySplit + theirTerms.royaltySplit >= 90 &&
      myTerms.royaltySplit + theirTerms.royaltySplit <= 110
    : false;
  const paymentMatch = myTerms && theirTerms
    ? Math.abs(myTerms.payment - theirTerms.payment) /
      (Math.max(myTerms.payment, theirTerms.payment) || 1) <= 0.3
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
    royaltyMatch, paymentMatch, deliverableMatch, timelineMatch, nonNegotiableMatch,
  ].filter(Boolean).length;

  // ── Actions ──────────────────────────────────────────────────
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
      setConfirmError(
        e?.message?.includes("Already confirmed")
          ? "You have already signed this agreement."
          : "Failed to confirm. Please try again."
      );
    }
  }

  // ── Reveal sequence ──────────────────────────────────────────
  function startRevealSequence(myT: Terms, theirT: Terms) {
    setIsCountingDown(true);
    setTimeout(() => {
      setIsCountingDown(false);
      setMyTerms(myT);
      setTheirTerms(theirT);
      setRevealed(true);
      setTimeout(() => {
        setFlareActive(true);
        setTimeout(() => setFlareActive(false), 220);
      }, 260);
    }, 1900);
  }

  async function handleReveal() {
    if (!walletClient) {
      setError("Wallet not connected. Please reconnect your wallet and try again.");
      return;
    }
    setIsRevealing(true);
    setError(null);
    try {
      let theirT: Terms;
      if (userRole === "creator") {
        theirT = await revealTermsVault(
          joinerVaultUuid, joinerEncryptedData, walletClient, publicClient
        ) as Terms;
      } else {
        theirT = await revealTermsVault(
          creatorVaultUuid, creatorEncryptedData, walletClient, publicClient
        ) as Terms;
      }
      const storedTerms = localStorage.getItem(`ownTerms_${roomId}`);
      const localTerms  = storedTerms ? JSON.parse(storedTerms) : null;
      const myT         = (ownTerms || localTerms) as Terms;
      setIsRevealing(false);
      startRevealSequence(myT, theirT);
    } catch (e) {
      if (e instanceof VaultError) {
        setError(e.userMessage);
        setIsRetryable(e.code !== "VAULT_NOT_FOUND" && e.code !== "DECRYPTION_FAILED");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Error: ${msg}`);
        setIsRetryable(true);
      }
      setIsRevealing(false);
    }
  }

  // ── Summary HTML generator ────────────────────────────────────
  function buildSummaryHtml(): string {
    if (!myTerms || !theirTerms) return "";
    const now = new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    const compromise = {
      royalty:  !royaltyMatch  ? `${Math.round((myTerms.royaltySplit + theirTerms.royaltySplit) / 2)}% / ${100 - Math.round((myTerms.royaltySplit + theirTerms.royaltySplit) / 2)}%` : null,
      payment:  !paymentMatch  ? `$${Math.round((myTerms.payment + theirTerms.payment) / 2)}` : null,
      timeline: !timelineMatch ? new Date((new Date(myTerms.timeline).getTime() + new Date(theirTerms.timeline).getTime()) / 2)
          .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null,
    };
    const html = `<!DOCTYPE html><html><head><title>Deal Room Summary — ${roomId}</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;padding:48px;font-size:14px;}h1{font-size:22px;font-weight:700;margin-bottom:4px;}.meta{color:#666;font-size:12px;margin-bottom:32px;}.section{margin-bottom:28px;}.section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:12px;}table{width:100%;border-collapse:collapse;}th{text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;color:#888;padding:6px 10px;border-bottom:2px solid #eee;}td{padding:10px;border-bottom:1px solid #f0f0f0;font-size:13px;}.badge-match{background:#d1fae5;color:#065f46;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:500;}.badge-gap{background:#fef3c7;color:#92400e;font-size:11px;padding:2px 8px;border-radius:999px;font-weight:500;}.summary-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;}.summary-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;}.summary-row:last-child{border-bottom:none;}.label{color:#666;}.value{font-weight:600;}.footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;}</style></head><body><h1>Deal Room Summary</h1><p class="meta">Room ID: ${roomId} &nbsp;·&nbsp; Generated: ${now}</p><div class="section"><p class="section-title">Parties</p><div class="summary-box"><div class="summary-row"><span class="label">Creator</span><span class="value">${creatorAddress}</span></div><div class="summary-row"><span class="label">Counterparty</span><span class="value">${joinerAddress}</span></div></div></div><div class="section"><p class="section-title">Terms Comparison</p><table><thead><tr><th>Field</th><th>Your Terms</th><th>Their Terms</th><th>Status</th></tr></thead><tbody><tr><td>Royalty Split</td><td>${myTerms.royaltySplit}%</td><td>${theirTerms.royaltySplit}%</td><td><span class="${royaltyMatch?'badge-match':'badge-gap'}">${royaltyMatch?'Close match':'Gap'}</span></td></tr><tr><td>Deliverable</td><td>${myTerms.deliverable}</td><td>${theirTerms.deliverable}</td><td><span class="${deliverableMatch?'badge-match':'badge-gap'}">${deliverableMatch?'Close match':'Gap'}</span></td></tr><tr><td>Timeline</td><td>${myTerms.timeline}</td><td>${theirTerms.timeline}</td><td><span class="${timelineMatch?'badge-match':'badge-gap'}">${timelineMatch?'Close match':'Gap'}</span></td></tr><tr><td>Payment</td><td>$${myTerms.payment}</td><td>$${theirTerms.payment}</td><td><span class="${paymentMatch?'badge-match':'badge-gap'}">${paymentMatch?'Close match':'Gap'}</span></td></tr><tr><td>Non-negotiable</td><td>${myTerms.nonNegotiable}</td><td>${theirTerms.nonNegotiable}</td><td><span class="${nonNegotiableMatch?'badge-match':'badge-gap'}">${nonNegotiableMatch?'Close match':'Gap'}</span></td></tr></tbody></table></div><div class="section"><p style="font-size:15px;font-weight:700;margin-bottom:4px;">${alignedCount} / 5 fields aligned</p>${compromise.royalty||compromise.payment||compromise.timeline?`<p class="section-title" style="margin-top:16px;">Suggested Compromise</p><div class="summary-box">${compromise.royalty?`<div class="summary-row"><span class="label">Royalty split</span><span class="value">${compromise.royalty}</span></div>`:''} ${compromise.payment?`<div class="summary-row"><span class="label">Upfront payment</span><span class="value">${compromise.payment}</span></div>`:''} ${compromise.timeline?`<div class="summary-row"><span class="label">Timeline</span><span class="value">${compromise.timeline}</span></div>`:''}</div>`:''}</div><div class="section"><p class="section-title">Onchain Agreement</p><div class="summary-box"><div class="summary-row"><span class="label">Creator</span><span class="value">${creatorSigned?'✓ Signed':'Pending'}</span></div><div class="summary-row"><span class="label">Counterparty</span><span class="value">${joinerSigned?'✓ Signed':'Pending'}</span></div></div></div><div class="footer"><p>Terms sealed via Confidential Data Rails (CDR) on Story Protocol · dealroom-red.vercel.app</p></div></body></html>`;
    return html;
  }

  function handlePreviewSummary() {
    const html = buildSummaryHtml();
    if (!html) return;
    setPreviewHtml(html);
    setShowPreview(true);
  }

  function handleDownloadSummary() {
    const html = buildSummaryHtml();
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `deal-summary-${roomId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Match badge ──────────────────────────────────────────────
  function matchBadge(isMatch: boolean) {
    return isMatch ? (
      <span className="text-[0.65rem] bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20 px-2 py-0.5 rounded-full whitespace-nowrap">
        Match
      </span>
    ) : (
      <span className="text-[0.65rem] bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 px-2 py-0.5 rounded-full whitespace-nowrap">
        Gap
      </span>
    );
  }

 const keyframes = `
    @keyframes flareOut {
      0%   { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes sweep {
      0%   { width: 0%; opacity: 1; }
      85%  { width: 100%; opacity: 1; }
      100% { width: 100%; opacity: 0; }
    }
    @keyframes labelFade {
      0%   { opacity: 0; }
      15%  { opacity: 1; }
      85%  { opacity: 1; }
      100% { opacity: 0; }
    }
  `;

  // ────────────────────────────────────────────────────────────
  // RENDER: Countdown phase
  // ────────────────────────────────────────────────────────────
  if (!revealed && isCountingDown) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: keyframes }} />
        <div className="flex flex-col items-center gap-5 w-full">
          <div className="gloss-panel w-full px-6 py-12 flex flex-col items-center justify-center gap-5">
            <div className="w-full flex flex-col gap-3">
              {/* Track */}
              <div className="relative w-full h-[2px] bg-white/[0.07] rounded-full overflow-hidden">
                {/* Fill */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    height: "100%",
                    background: "linear-gradient(90deg, #7C72F5, #6457E8)",
                    boxShadow: "0 0 12px rgba(124,114,245,0.6)",
                    animation: "sweep 1.9s cubic-bezier(0.4, 0, 0.2, 1) forwards",
                  }}
                />
              </div>
              <p
                className="text-[0.65rem] text-white/30 uppercase tracking-[0.22em] text-center"
                style={{ animation: "labelFade 1.9s ease forwards" }}
              >
                Unsealing terms
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ────────────────────────────────────────────────────────────
  // RENDER: Pre-reveal (normal + decrypting states)
  // ────────────────────────────────────────────────────────────
  if (!revealed) {
    return (
      <div className="flex flex-col items-center gap-5 w-full">
        <div className="gloss-panel w-full px-6 py-8 flex flex-col items-center gap-5 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-[#7C72F5]/20 blur-xl rounded-full scale-[2]" />
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl gloss-panel border border-[#7C72F5]/20">
              <svg className="w-7 h-7 text-[#7C72F5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-white font-semibold text-lg">Both terms are sealed.</p>
            <p className="text-white/35 text-sm">Click reveal to decrypt and compare your terms side by side.</p>
          </div>

          {error && (
            <div className="flex flex-col gap-3 w-full gloss-panel border border-red-800/40 bg-red-900/10 px-4 py-3 text-left">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-400 text-sm leading-relaxed">{error}</span>
              </div>
              {isRetryable && (
                <button
                  onClick={handleReveal}
                  className="self-start rounded-md bg-red-800/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-700/40 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleReveal}
            disabled={isRevealing}
            className="w-full rounded-lg bg-[#7C72F5] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6457E8] disabled:opacity-60 transition-colors glow-accent"
          >
            {isRevealing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Decrypting terms...
              </span>
            ) : "Reveal Both Terms"}
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // RENDER: Revealed
  // ────────────────────────────────────────────────────────────
   const rows = [
    { label: "Royalty",     mine: `${myTerms?.royaltySplit}%`,       theirs: `${theirTerms?.royaltySplit}%`,       match: royaltyMatch,       wrap: false },
    { label: "Deliverable", mine: myTerms?.deliverable ?? "",         theirs: theirTerms?.deliverable ?? "",        match: deliverableMatch,   wrap: true  },
    { label: "Timeline",    mine: myTerms?.timeline ?? "",            theirs: theirTerms?.timeline ?? "",           match: timelineMatch,      wrap: false },
    { label: "Payment",     mine: `$${myTerms?.payment}`,            theirs: `$${theirTerms?.payment}`,            match: paymentMatch,       wrap: false },
    { label: "Non-neg.",    mine: myTerms?.nonNegotiable ?? "",       theirs: theirTerms?.nonNegotiable ?? "",      match: nonNegotiableMatch, wrap: true  },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />

      {/* ── Radial flare ── */}
      {flareActive && (
        <div
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background:
              "radial-gradient(circle at 50% 42%, rgba(124,114,245,0.38) 0%, rgba(100,87,232,0.14) 38%, transparent 68%)",
            animation: "flareOut 0.22s ease-out forwards",
          }}
        />
      )}

      {/* ── Card — rises as a single unit ── */}
      <div
        className="flex flex-col gap-4 w-full"
        style={{
          opacity:    cardRisen ? 1 : 0,
          transform:  cardRisen ? "translateY(0px)" : "translateY(36px)",
          transition: "opacity 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Comparison table */}
        <div className="gloss-panel overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center px-4 pt-3.5 pb-2.5">
            <span className="text-[0.65rem] text-white/25 uppercase tracking-wider w-[28%]">Field</span>
            <span className="text-[0.65rem] text-[#4ADE80] uppercase tracking-wider w-[27%] text-center">Yours</span>
            <span className="text-[0.65rem] text-[#7C72F5] uppercase tracking-wider w-[27%] text-right">Theirs</span>
            <span className="text-[0.65rem] text-white/25 uppercase tracking-wider w-[18%] text-right">Match</span>
          </div>

          {rows.map((row, i) => (
            <div
              key={i}
              className={`flex ${row.wrap ? "items-start" : "items-center"} px-4 py-3 border-t border-white/[0.05]`}
              style={{
                opacity:    visibleRows.includes(i) ? 1 : 0,
                transform:  visibleRows.includes(i) ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.35s ease, transform 0.35s ease",
              }}
            >
              <span className={`text-xs sm:text-sm text-white/50 w-[28%] ${row.wrap ? "pt-0.5" : ""}`}>
                {row.label}
              </span>
              <span className={`text-xs sm:text-sm text-white w-[27%] text-center ${row.wrap ? "break-words hyphens-auto pt-0.5" : ""}`}>
                {row.mine}
              </span>
              <span className={`text-xs sm:text-sm text-white w-[27%] text-right ${row.wrap ? "break-words hyphens-auto pt-0.5" : ""}`}>
                {row.theirs}
              </span>
              {/* Badge — staggered separately after rows */}
              <span
                className={`w-[18%] flex justify-end ${row.wrap ? "pt-0.5" : ""}`}
                style={{
                  opacity:    visibleBadges.includes(i) ? 1 : 0,
                  transform:  visibleBadges.includes(i) ? "scale(1)" : "scale(0.65)",
                  transition: "opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                {matchBadge(row.match)}
              </span>
            </div>
          ))}
        </div>

        {/* Alignment score */}
        <div className="gloss-panel px-4 py-3 flex items-center justify-center gap-2">
          <span className="text-xl font-bold text-white" style={{ transition: "all 0.2s ease" }}>
            {displayCount}
          </span>
          <span className="text-white/30 text-sm">/</span>
          <span className="text-xl font-bold text-white/30">5</span>
          <span className="text-white/35 text-sm ml-1">fields aligned</span>
        </div>

        {/* ── Action area — gated until sequence completes ── */}
        <div
          style={{
            opacity:       buttonsReady ? 1 : 0,
            transform:     buttonsReady ? "translateY(0)" : "translateY(8px)",
            transition:    "opacity 0.4s ease, transform 0.4s ease",
            pointerEvents: buttonsReady ? "auto" : "none",
          }}
          className="flex flex-col gap-3"
        >
          {/* Signing status */}
          <div className="gloss-panel px-4 py-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-colors ${creatorSigned ? "bg-[#4ADE80]" : "bg-white/15"}`} />
              <span className="text-white/45 text-xs sm:text-sm">Creator</span>
              {creatorSigned && <span className="text-[#4ADE80] text-xs">Signed</span>}
            </div>
            <div className="flex items-center gap-2">
              {joinerSigned && <span className="text-[#4ADE80] text-xs">Signed</span>}
              <span className="text-white/45 text-xs sm:text-sm">Counterparty</span>
              <div className={`w-2 h-2 rounded-full transition-colors ${joinerSigned ? "bg-[#4ADE80]" : "bg-white/15"}`} />
            </div>
          </div>

          {bothSigned ? (
            <div className="gloss-panel px-4 py-4 flex flex-col items-center gap-2 border border-[#4ADE80]/25 bg-[#4ADE80]/5 shadow-[0_0_24px_rgba(74,222,128,0.07)]">
              <p className="text-[#4ADE80] text-sm font-semibold">🔒 Deal sealed onchain by both parties</p>
              {txHash && (
                <a
                  href={`https://aeneid.storyscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4ADE80]/55 text-xs underline hover:text-[#4ADE80] transition-colors"
                >
                  View on Storyscan →
                </a>
              )}
            </div>
          ) : confirmed ? (
            <div className="gloss-panel px-4 py-3 text-center border border-[#4ADE80]/15">
              <p className="text-[#4ADE80] text-sm font-medium">✓ You have signed the agreement onchain</p>
              <p className="text-[#4ADE80]/45 text-xs mt-1">Waiting for the other party to sign</p>
            </div>
          ) : (
            <button
              onClick={handleConfirmDeal}
              disabled={isConfirming}
              className="w-full rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60 transition-colors"
            >
              {isConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing...
                </span>
              ) : "Sign Agreement Onchain"}
            </button>
          )}

          {confirmError && <p className="text-red-400 text-xs text-center">{confirmError}</p>}
        </div>

        {/* ── Compromise + Download — follow button gate ── */}
        <div
          style={{
            opacity:       buttonsReady ? 1 : 0,
            transition:    "opacity 0.4s ease 0.12s",
            pointerEvents: buttonsReady ? "auto" : "none",
          }}
        >
          {myTerms && theirTerms && alignedCount < 5 && (
            <div className="gloss-panel p-4 flex flex-col gap-3 mb-4">
              <p className="text-xs text-white/30 uppercase tracking-wider">Suggested Compromise</p>
              {!royaltyMatch && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40">Royalty split</span>
                  <span className="text-white font-medium">
                    {Math.round((myTerms.royaltySplit + theirTerms.royaltySplit) / 2)}% / {100 - Math.round((myTerms.royaltySplit + theirTerms.royaltySplit) / 2)}%
                  </span>
                </div>
              )}
              {!paymentMatch && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40">Upfront payment</span>
                  <span className="text-white font-medium">${Math.round((myTerms.payment + theirTerms.payment) / 2)}</span>
                </div>
              )}
              {!timelineMatch && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40">Timeline</span>
                  <span className="text-white font-medium">
                    {new Date((new Date(myTerms.timeline).getTime() + new Date(theirTerms.timeline).getTime()) / 2)
                      .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
              {!deliverableMatch && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40">Deliverable</span>
                  <span className="text-white/30 text-xs italic">Needs direct discussion</span>
                </div>
              )}
              {!nonNegotiableMatch && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40">Non-negotiable</span>
                  <span className="text-white/30 text-xs italic">Needs direct discussion</span>
                </div>
              )}
              <p className="text-xs text-white/20 mt-1 border-t border-white/[0.05] pt-3">
                Calculated midpoints — both parties must agree to proceed.
              </p>
            </div>
          )}

          <button
            onClick={handlePreviewSummary}
            className="w-full gloss-panel px-6 py-3 text-sm font-semibold text-white/35 hover:text-white/65 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview & Download Summary
          </button>

          {showPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
              <div className="w-full max-w-2xl flex flex-col gap-3 max-h-[90vh]">
                <div className="flex items-center justify-between">
                  <p className="text-white font-semibold text-sm">Deal Summary Preview</p>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-white/35 hover:text-white/70 transition-colors text-xs"
                  >
                    ✕ Close
                  </button>
                </div>
                <iframe
                  srcDoc={previewHtml}
                  className="w-full rounded-lg bg-white"
                  style={{ height: "65vh", border: "none" }}
                  sandbox="allow-same-origin"
                />
                <button
                  onClick={() => { handleDownloadSummary(); setShowPreview(false); }}
                  className="w-full rounded-lg bg-[#7C72F5] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6457E8] transition-colors glow-accent flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  Download
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
