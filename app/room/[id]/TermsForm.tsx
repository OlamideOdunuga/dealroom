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

  return (
    <div className="flex flex-col gap-6 w-full max-w-lg">
  <div className="border-b border-gray-700 pb-4">
    <h2 className="text-white font-semibold text-lg">Your Terms</h2>
    <p className="text-gray-400 text-sm mt-1">These are encrypted and sealed. The other party won't see them until you both commit.</p>
  </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300 font-medium">My royalty split</label>
        <input
          type="range"
          min={0}
          max={100}
          value={royaltySplit}
          onChange={(e) => setRoyaltySplit(Number(e.target.value))}
          className="w-full"
        />
        <span className="text-white text-sm">I want {royaltySplit}% of revenue</span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300 font-medium">My deliverable</label>
        <textarea
          value={deliverable}
          onChange={(e) => setDeliverable(e.target.value)}
          placeholder="What are you bringing to the collab?"
          className="bg-gray-800 text-white rounded-lg p-3 text-sm resize-none h-24 outline-none border border-gray-700 focus:border-gray-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300 font-medium">Deliver by</label>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={timeline ? timeline.split("-")[2] : ""}
            onChange={(e) => {
              const parts = timeline ? timeline.split("-") : ["", "", ""];
              setTimeline(`${parts[0] || new Date().getFullYear()}-${parts[1] || "01"}-${e.target.value}`);
            }}
            className="w-full min-h-[48px] bg-gray-800 text-white rounded-lg p-3 text-sm outline-none border border-gray-700 focus:border-gray-500 transition-colors"
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d).padStart(2, "0")}>{d}</option>
            ))}
          </select>
          <select
            value={timeline ? timeline.split("-")[1] : ""}
            onChange={(e) => {
              const parts = timeline ? timeline.split("-") : ["", "", ""];
              setTimeline(`${parts[0] || new Date().getFullYear()}-${e.target.value}-${parts[2] || "01"}`);
            }}
            className="flex-1 bg-gray-800 text-white rounded-lg p-3 text-sm outline-none border border-gray-700 focus:border-gray-500 transition-colors"
          >
            <option value="">Month</option>
            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
            ))}
          </select>
          <select
            value={timeline ? timeline.split("-")[0] : ""}
            onChange={(e) => {
              const parts = timeline ? timeline.split("-") : ["", "", ""];
              setTimeline(`${e.target.value}-${parts[1] || "01"}-${parts[2] || "01"}`);
            }}
            className="flex-1 bg-gray-800 text-white rounded-lg p-3 text-sm outline-none border border-gray-700 focus:border-gray-500 transition-colors"
          >
            <option value="">Year</option>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300 font-medium">Payment I need upfront (USD)</label>
        <input
          type="number"
          value={payment}
          onChange={(e) => setPayment(Number(e.target.value))}
          className="bg-gray-800 text-white rounded-lg p-3 text-sm outline-none border border-gray-700 focus:border-gray-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-gray-300 font-medium">My one non-negotiable</label>
        <input
          type="text"
          value={nonNegotiable}
          onChange={(e) => setNonNegotiable(e.target.value)}
          placeholder="Something you won't compromise on"
          className="bg-gray-800 text-white rounded-lg p-3 text-sm outline-none border border-gray-700 focus:border-gray-500 transition-colors"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-950 disabled:opacity-60"
      >
        {isSubmitting ? "Sealing..." : "Seal My Terms"}
      </button>
    </div>
  );
}