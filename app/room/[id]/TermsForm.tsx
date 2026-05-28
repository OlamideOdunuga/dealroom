"use client";

import { useState } from "react";

type Terms = {
  royaltySplit: number;
  deliverable: string;
  timeline: string;
  payment: number;
  nonNegotiable: string;
};

export default function TermsForm({
  onSubmit,
}: {
  onSubmit: (terms: Terms) => void;
}) {
  const [royaltySplit, setRoyaltySplit] = useState(50);
  const [deliverable, setDeliverable] = useState("");
  const [timeline, setTimeline] = useState("");
  const [payment, setPayment] = useState(0);
  const [nonNegotiable, setNonNegotiable] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    await onSubmit({ royaltySplit, deliverable, timeline, payment, nonNegotiable });
    setIsSubmitting(false);
  }

  const inputClass =
    "w-full bg-white/[0.03] border border-white/[0.08] text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#7C72F5]/50 transition-colors placeholder-white/25";

  return (
    <div className="flex flex-col gap-5 w-full max-w-lg">

      {/* Header */}
      <div className="pb-4 border-b border-white/[0.06]">
        <h2 className="text-white font-semibold text-lg">Your Terms</h2>
        <p className="text-white/35 text-sm mt-1">
          Encrypted and sealed. The other party won&apos;t see them until you both commit.
        </p>
      </div>

      {/* Royalty split */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm text-white/55 font-medium">My royalty split</label>
          <span className="text-sm font-semibold text-[#7C72F5]">{royaltySplit}%</span>
        </div>
        <div className="gloss-panel px-3 py-3">
          <input
            type="range"
            min={0}
            max={100}
            value={royaltySplit}
            onChange={(e) => setRoyaltySplit(Number(e.target.value))}
            className="w-full accent-[#7C72F5] cursor-pointer"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[0.65rem] text-white/20">0%</span>
            <span className="text-[0.65rem] text-white/20">100%</span>
          </div>
        </div>
        <p className="text-xs text-white/30">You want <span className="text-white/55">{royaltySplit}%</span> of revenue — counterparty gets <span className="text-white/55">{100 - royaltySplit}%</span></p>
      </div>

      {/* Deliverable */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-white/55 font-medium">My deliverable</label>
        <textarea
          value={deliverable}
          onChange={(e) => setDeliverable(e.target.value)}
          placeholder="What are you bringing to the collab?"
          className={`${inputClass} resize-none h-24`}
        />
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-white/55 font-medium">Deliver by</label>
        <input
          type="date"
          value={timeline}
          min={new Date().toISOString().split("T")[0]}
          onChange={(e) => setTimeline(e.target.value)}
          className={`${inputClass} [color-scheme:dark]`}
        />
      </div>

      {/* Payment */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-white/55 font-medium">Payment I need upfront (USD)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
          <input
            type="number"
            value={payment}
            onChange={(e) => setPayment(Number(e.target.value))}
            className={`${inputClass} pl-7`}
          />
        </div>
      </div>

      {/* Non-negotiable */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-white/55 font-medium">My one non-negotiable</label>
        <input
          type="text"
          value={nonNegotiable}
          onChange={(e) => setNonNegotiable(e.target.value)}
          placeholder="Something you won't compromise on"
          className={inputClass}
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="rounded-lg bg-[#7C72F5] px-6 py-3 text-sm font-semibold text-white hover:bg-[#6457E8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors glow-accent mt-1"
      >
        {isSubmitting ? "Sealing..." : "Seal My Terms"}
      </button>
    </div>
  );
}