"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { createRoom } from "@/lib/rooms";
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
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

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
    if (status === "waiting") return { text: "Waiting", color: "text-yellow-400 bg-yellow-900/30" };
    if (status === "both_joined") return { text: "In progress", color: "text-blue-400 bg-blue-900/30" };
    if (status === "both_committed") return { text: "Completed", color: "text-green-400 bg-green-900/30" };
    return { text: status, color: "text-gray-400 bg-gray-800" };
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric"
    });
  }

  return (
    <div className="flex min-h-screen bg-gray-950">

      {/* Sidebar */}
      <aside className="w-72 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col px-5 py-8 gap-8">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Deal Room</h1>
          <p className="text-xs text-gray-500">Confidential creator collabs</p>
        </div>

        <ConnectButton label="Connect Wallet" />

        {isConnected && (
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? "Creating..." : "+ Create a Deal Room"}
          </button>
        )}

        {isConnected && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Your stats</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-lg px-3 py-3">
                <p className="text-2xl font-bold text-white">{rooms.length}</p>
                <p className="text-xs text-gray-400 mt-1">Total deals</p>
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-3">
                <p className="text-2xl font-bold text-green-400">{completedDeals}</p>
                <p className="text-xs text-gray-400 mt-1">Completed</p>
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-3">
                <p className="text-2xl font-bold text-yellow-400">{pendingDeals}</p>
                <p className="text-xs text-gray-400 mt-1">Pending</p>
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-3">
                <p className="text-2xl font-bold text-blue-400">
                  {rooms.filter(r => r.creator_address === address).length}
                </p>
                <p className="text-xs text-gray-400 mt-1">Created</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 px-10 py-10">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <h2 className="text-3xl font-bold text-white">Negotiate confidentially.</h2>
            <p className="text-gray-400 max-w-md">
              Neither party sees the other&apos;s terms until both commit. Connect your wallet to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">
                Welcome back{address ? `, ${address.slice(0, 6)}...${address.slice(-4)}` : ""}
              </h2>
              <p className="text-gray-400 text-sm">Here are all the deal rooms you&apos;ve been part of.</p>
            </div>

            {loadingRooms ? (
              <p className="text-gray-400 text-sm">Loading your deals...</p>
            ) : rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 border border-dashed border-gray-700 rounded-xl">
                <p className="text-gray-400">No deals yet.</p>
                <button
                  onClick={handleCreateRoom}
                  disabled={isCreating}
                  className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-950 hover:bg-gray-200 disabled:opacity-60"
                >
                  {isCreating ? "Creating..." : "Create your first Deal Room"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {rooms.map((room) => {
                  const s = statusLabel(room.status);
                  const isCreator = room.creator_address === address;
                  return (
                    <div
                      key={room.id}
                      onClick={() => router.push(`/room/${room.id}`)}
                      className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 cursor-pointer hover:border-gray-600 transition-colors"
                    >
                      <div className="flex flex-col gap-1">
                        <p className="text-white text-sm font-medium">Room #{room.id}</p>
                        <p className="text-gray-500 text-xs">{formatDate(room.created_at)} · {isCreator ? "You created" : "You joined"}</p>
                      </div>
                      <span className={`text-xs font-medium px-3 py-1 rounded-full ${s.color}`}>
                        {s.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}