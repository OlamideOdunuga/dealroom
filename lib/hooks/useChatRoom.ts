import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_address: string;
  sender_ens: string | null;
  content: string;
  created_at: string;
}

export function useChatRoom(
  roomId: string,
  senderAddress: string | undefined,
  senderEns?: string | null
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing messages on mount
  useEffect(() => {
    if (!roomId) return;

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) {
        setError(error.message);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    fetchMessages();
  }, [roomId]);

  // Subscribe to realtime new messages
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.find((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!senderAddress || !content.trim()) return;

      const { error } = await supabase.from("messages").insert({
        room_id: roomId,
        sender_address: senderAddress,
        sender_ens: senderEns || null,
        content: content.trim(),
      });

      if (error) setError(error.message);
    },
    [roomId, senderAddress, senderEns]
  );

  return { messages, loading, error, sendMessage };
}