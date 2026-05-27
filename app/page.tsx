"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { useAccount, useEnsName } from "wagmi";
import { useRouter } from "next/navigation";
import { createRoom, cancelRoom } from "@/lib/rooms";
import { supabase } from "@/lib/supabase";

type Room = {
  id: string;
  status: string;
  created_at: string;
  creator_address: string;
  joiner_address: string | null;
};

export default function Home() {
  const { isConnected, address } = useAccount();
  const { data: ensName } = useEnsName({ address, chainId: 1 });
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [joinError, setJoinError] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancellingRoomId, setCancellingRoomId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [filter, setFilter] = useState<"all" | "both_committed" | "both_joined" | "cancelled" | "waiting">("all");

  function handleJoinById() {
    const trimmed = joinId.trim();
    if (!trimmed) {
      setJoinError("Please enter a Room ID.");
      return;
    }
    setJoinError("");
    router.push(`/room/${trimmed}`);
  }

  useEffect(() => {
    if (!address) return;
    async function fetchRooms() {
      setLoadingRooms(true);
      const { data } = await supabase
        .from("rooms")
        .select("*")
        .or(`creator_address.eq.${address},joiner_address.eq.${address}`)
        .order("created_at", { ascending: false });
      setRooms(data || []);
      setLoadingRooms(false);
    }
    fetchRooms();
  }, [address]);

  async function handleCancelRoom(roomId: string) {
    setIsCancelling(true);
    try {
      await cancelRoom(roomId);
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, status: "cancelled" } : r));
    } catch {
      // silent
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
      setCancellingRoomId(null);
    }
  }

  async function handleAddNetwork() {
    try {
      await (window as any).ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x523",
          chainName: "Story Aeneid Testnet",
          nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
          rpcUrls: ["https://aeneid.storyrpc.io"],
          blockExplorerUrls: ["https://aeneid.storyscan.io"],
        }],
      });
    } catch {
      // user rejected or already added
    }
  }

  async function handleCreateRoom() {
    if (!address) return;
    setIsCreating(true);
    try {
      const roomId = await createRoom(address);
      router.push(`/room/${roomId}`);
    } catch {
      setIsCreating(false);
    }
  }

  const completedDeals = rooms.filter(r => r.status === "both_committed").length;
  const pendingDeals = rooms.filter(r => r.status !== "both_committed").length;

  function statusLabel(status: string) {
    if (status === "waiting") return { text: "Waiting", color: "text-yellow-400 bg-yellow-900/20" };
    if (status === "both_joined") return { text: "In Progress", color: "text-blue-400 bg-blue-900/20" };
    if (status === "both_committed") return { text: "Completed", color: "text-green-400 bg-green-900/20" };
    if (status === "cancelled") return { text: "Cancelled", color: "text-red-400 bg-red-900/20" };
    return { text: status, color: "text-[#B8AEA3] bg-[#24211D]" };
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric"
    });
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#11110F]">

      {/* Sidebar */}
      <aside className="w-full md:w-72 md:min-h-screen bg-[#1A1916] border-b md:border-b-0 md:border-r border-[#332D27] flex flex-col px-5 py-6 gap-6">
        <div>
          <h1 className="text-xl font-bold text-[#F3EEE7] mb-1">Deal Room</h1>
          <p className="text-xs text-[#B8AEA3]">Confidential creator collabs</p>
        </div>

        <ConnectButton label="Connect Wallet" />

        {!isConnected && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleAddNetwork}
              className="self-start rounded-lg border border-[#332D27] px-3 py-2 text-xs font-semibold text-[#B8AEA3] hover:text-[#F3EEE7] hover:border-[#C98B47] transition-colors flex items-center gap-2"
            >
              <span className="text-base">🔗</span>
              Add Story Aeneid Testnet
            </button>
            <p className="text-xs text-[#B8AEA3]">
              Need testnet IP for gas?{" "}
              <span className="text-[#C98B47]">faucet.story.foundation</span>
            </p>
          </div>
        )}

        {isConnected && (
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="rounded-lg bg-[#C98B47] px-4 py-3 text-sm font-semibold text-[#11110F] hover:bg-[#E0A15A] disabled:opacity-60 disabled:cursor-not-allowed transition-colors glow-amber glow-amber-hover"
          >
            {isCreating ? "Creating..." : "+ Create a Deal Room"}
          </button>
        )}

        {isConnected && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[#B8AEA3] uppercase tracking-wide">Join by Room ID</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinId}
                onChange={(e) => { setJoinId(e.target.value); setJoinError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinById()}
                placeholder="Paste Room ID"
                className="flex-1 bg-[#24211D] text-[#F3EEE7] text-sm rounded-lg px-3 py-2 outline-none border border-[#332D27] focus:border-[#C98B47] transition-colors placeholder-[#B8AEA3]"
              />
              <button
                onClick={handleJoinById}
                className="rounded-lg bg-[#24211D] border border-[#332D27] px-3 py-2 text-sm font-semibold text-[#F3EEE7] hover:border-[#C98B47] transition-colors"
              >
                Go
              </button>
            </div>
            {joinError && <p className="text-xs text-red-400">{joinError}</p>}
          </div>
        )}

        {isConnected && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[#B8AEA3] uppercase tracking-wide">Your stats</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#24211D] rounded-lg px-3 py-3 border border-[#332D27] glow-amber-soft">
                <p className="text-2xl font-bold text-[#F3EEE7]">{rooms.length}</p>
                <p className="text-xs text-[#B8AEA3] mt-1">Total deals</p>
              </div>
              <div className="bg-[#24211D] rounded-lg px-3 py-3 border border-[#332D27] glow-amber-soft">
                <p className="text-2xl font-bold text-[#C98B47]">{completedDeals}</p>
                <p className="text-xs text-[#B8AEA3] mt-1">Completed</p>
              </div>
              <div className="bg-[#24211D] rounded-lg px-3 py-3 border border-[#332D27] glow-amber-soft">
                <p className="text-2xl font-bold text-yellow-400">{pendingDeals}</p>
                <p className="text-xs text-[#B8AEA3] mt-1">Pending</p>
              </div>
              <div className="bg-[#24211D] rounded-lg px-3 py-3 border border-[#332D27] glow-amber-soft">
                <p className="text-2xl font-bold text-[#C98B47]">
                  {rooms.filter(r => r.creator_address === address).length}
                </p>
                <p className="text-xs text-[#B8AEA3] mt-1">Created</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <p className="text-xs text-[#B8AEA3] uppercase tracking-wide">How it works</p>
          <div className="flex flex-col gap-3">
            {[
              "Create a Deal Room and share the link with your collaborator",
              "Both parties privately submit their terms, encrypted on-chain via CDR",
              "Once both commit, reveal terms side by side and see where you align",
            ].map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="text-xs font-bold text-[#C98B47] bg-[#24211D] border border-[#332D27] rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-[#B8AEA3]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 px-5 md:px-10 py-8">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <h2 className="text-3xl font-bold text-[#F3EEE7]">Negotiate confidentially.</h2>
            <p className="text-[#B8AEA3] max-w-md">
              Neither party sees the other&apos;s terms until both commit. Connect your wallet to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-xl font-bold text-[#F3EEE7] mb-1">
                Welcome back{address ? `, ${ensName ?? `${address.slice(0, 6)}...${address.slice(-4)}`}` : ""}
              </h2>
              <p className="text-[#B8AEA3] text-sm">Here are all the deal rooms you&apos;ve been part of.</p>
            </div>

            {loadingRooms ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-[#1A1916] border border-[#332D27] rounded-xl px-5 py-4 animate-pulse"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="h-3.5 w-24 bg-[#24211D] rounded" />
                      <div className="h-3 w-36 bg-[#24211D] rounded" />
                    </div>
                    <div className="h-6 w-20 bg-[#24211D] rounded-full" />
                  </div>
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-6 py-20 border border-dashed border-[#332D27] rounded-xl px-6 text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#24211D] border border-[#332D27]">
                  <svg className="w-8 h-8 text-[#C98B47]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[#F3EEE7] font-medium">No deals yet</p>
                  <p className="text-[#B8AEA3] text-sm max-w-xs">Create your first confidential deal room and share the link with your collaborator</p>
                </div>
                <button
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  className="rounded-lg bg-[#C98B47] px-5 py-2.5 text-sm font-semibold text-[#11110F] hover:bg-[#E0A15A] disabled:opacity-60 transition-colors glow-amber glow-amber-hover"                >
                  {isCreating ? "Creating..." : "Create your first Deal Room"}
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: "all", label: "All" },
                    { key: "both_committed", label: "Completed" },
                    { key: "both_joined", label: "In Progress" },
                    { key: "waiting", label: "Waiting" },
                    { key: "cancelled", label: "Cancelled" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setFilter(tab.key as typeof filter)}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                        filter === tab.key
                          ? "bg-[#C98B47] text-[#11110F] glow-amber"
                          : "bg-[#24211D] text-[#B8AEA3] border border-[#332D27] hover:border-[#C98B47] hover:text-[#F3EEE7]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  {rooms
                    .filter((r) => filter === "all" || r.status === filter)
                    .map((room) => {
                      const s = statusLabel(room.status);
                      const isCreator = room.creator_address === address;
                      const isOlderThan24h = new Date().getTime() - new Date(room.created_at).getTime() > 24 * 60 * 60 * 1000;
                      const canCancel = isCreator && room.status !== "both_committed" && room.status !== "cancelled" && isOlderThan24h;

                      return (
                        <div
                          key={room.id}
                          onClick={() => router.push(`/room/${room.id}`)}
                          className="flex items-center justify-between bg-[#1A1916] border border-[#332D27] rounded-xl px-5 py-4 cursor-pointer glow-card-hover"
                        >
                          <div className="flex flex-col gap-1">
                            <p className="text-[#F3EEE7] text-sm font-medium">Room #{room.id}</p>
                            <p className="text-[#B8AEA3] text-xs">{formatDate(room.created_at)} · {isCreator ? "You created" : "You joined"}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-medium px-3 py-1 rounded-full ${s.color}`}>
                              {s.text}
                            </span>
                            {canCancel && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancellingRoomId(room.id);
                                  setShowCancelConfirm(true);
                                }}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-xl bg-[#1A1916] border border-[#332D27] p-6 flex flex-col gap-4">
            <h2 className="text-[#F3EEE7] font-semibold text-lg">Cancel this deal room?</h2>
            <p className="text-[#B8AEA3] text-sm leading-relaxed">
              This room will be closed and removed from your dashboard. <span className="text-[#F3EEE7]">This cannot be undone.</span>
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => { setShowCancelConfirm(false); setCancellingRoomId(null); }}
                className="flex-1 rounded-lg border border-[#332D27] px-4 py-2 text-sm font-semibold text-[#B8AEA3] hover:border-[#C98B47] hover:text-[#F3EEE7] transition-colors"
              >
                Keep Room
              </button>
              <button
                onClick={() => cancellingRoomId && handleCancelRoom(cancellingRoomId)}
                disabled={isCancelling}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}