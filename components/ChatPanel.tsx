"use client";

import { useEffect, useRef, useState } from "react";
import { useChatRoom, ChatMessage } from "@/hooks/useChatRoom";

interface ChatPanelProps {
  roomId: string;
  address: string | undefined;
  ensName?: string | null;
  isLocked?: boolean; // true when deal is sealed or cancelled
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPanel({ roomId, address, ensName, isLocked }: ChatPanelProps) {
  const { messages, loading, sendMessage } = useChatRoom(roomId, address, ensName);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-scroll to latest message
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  // Unread count when panel is closed
  useEffect(() => {
  if (messages.length === 0) return;
  if (!open) {
    const newCount = messages.length - prevCountRef.current;
    if (newCount > 0) setUnread((u) => u + newCount);
  }
  prevCountRef.current = messages.length;
}, [messages]);

  // Clear unread when opened
  useEffect(() => {
  if (open) {
    setUnread(0);
    prevCountRef.current = messages.length;
  }
}, [open]);


  async function handleSend() {
    if (!input.trim() || !address || isLocked) return;
    await sendMessage(input);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[#7C72F5] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#6457E8] transition-colors glow-accent"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Chat
        {unread > 0 && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#7C72F5] text-xs font-bold">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-40 w-80 flex flex-col rounded-2xl border border-white/[0.08] bg-[#0E0E1A] shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#7C72F5]" />
              <p className="text-sm font-semibold text-white">Deal Chat</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex flex-col gap-3 px-4 py-4 h-72 overflow-y-auto">
            {loading && (
              <p className="text-white/25 text-xs text-center mt-8">Loading messages...</p>
            )}
            {!loading && messages.length === 0 && (
              <p className="text-white/25 text-xs text-center mt-8">
                No messages yet. Start the conversation.
              </p>
            )}
            {messages.map((msg: ChatMessage) => {
              const isOwn = msg.sender_address.toLowerCase() === address?.toLowerCase();
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}
                >
                  <p className="text-white/25 text-[10px]">
                    {msg.sender_ens || formatAddress(msg.sender_address)} · {formatTime(msg.created_at)}
                  </p>
                  <div
                 className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                 isOwn
                  ? "bg-[#7C72F5] text-white"
                  : "bg-white/[0.06] text-white/80"
                 }`}
                 >
                  {msg.content}
                 </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-white/[0.06]">
            {isLocked ? (
              <p className="text-white/25 text-xs text-center py-1">
                🔒 Chat locked. Deal is sealed
              </p>
            ) : !address ? (
              <p className="text-white/25 text-xs text-center py-1">
                Connect wallet to chat
              </p>
            ) : (
              <div className="flex gap-2">
               <textarea
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={(e) => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  }}
  placeholder="Type a message..."
  rows={1}
  className="flex-1 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#7C72F5]/50 resize-none"
/>
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="rounded-lg bg-[#7C72F5] px-3 py-2 text-white hover:bg-[#6457E8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}