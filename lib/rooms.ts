import { supabase } from "@/lib/supabase";

export type Room = {
  id: string;
  creator_address: string;
  joiner_address: string | null;
  creator_vault_uuid: string | null;
  joiner_vault_uuid: string | null;
  creator_encrypted_data: string | null;
  joiner_encrypted_data: string | null;
  status: string;
  creator_terms: string | null;
  joiner_terms: string | null;
};

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function createRoom(creatorAddress: string): Promise<string> {
  const roomId = generateRoomId();

  const { error } = await supabase.from("rooms").insert({
    id: roomId,
    creator_address: creatorAddress,
    status: "waiting",
  });

  if (error) {
    throw error;
  }

  return roomId;
}

export async function getRoom(roomId: string): Promise<Room> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (error) {
    throw error;
  }

  return data as Room;
}

export async function joinRoom(
  roomId: string,
  joinerAddress: string,
): Promise<Room> {
  const { data, error } = await supabase
    .from("rooms")
    .update({
      joiner_address: joinerAddress,
      status: "both_joined",
    })
    .eq("id", roomId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Room;
}

export async function updateVault(
  roomId: string,
  role: "creator" | "joiner",
  vaultUuid: string,
  encryptedData: string,
  terms: string
): Promise<Room> {
  const vaultUpdate =
    role === "creator"
      ? { creator_vault_uuid: vaultUuid, creator_encrypted_data: encryptedData, creator_terms: terms }
      : { joiner_vault_uuid: vaultUuid, joiner_encrypted_data: encryptedData, joiner_terms: terms };

  const { data, error } = await supabase
    .from("rooms")
    .update(vaultUpdate)
    .eq("id", roomId)
    .select()
    .single();

  if (error) throw error;

  const room = data as Room;

  if (room.creator_vault_uuid && room.joiner_vault_uuid) {
    const { data: committedRoom, error: commitError } = await supabase
      .from("rooms")
      .update({ status: "both_committed" })
      .eq("id", roomId)
      .select()
      .single();

    if (commitError) throw commitError;
    return committedRoom as Room;
  }

  return room;
}

export async function cancelRoom(roomId: string): Promise<void> {
  const { error } = await supabase
    .from("rooms")
    .update({ status: "cancelled" })
    .eq("id", roomId);

  if (error) throw error;
}
export async function resubmitVault(
  roomId: string,
  role: "creator" | "joiner",
  newVaultUuid: string,
  terms: string,
): Promise<void> {
  const update = role === "creator"
    ? { creator_vault_uuid: newVaultUuid, creator_terms: terms }
    : { joiner_vault_uuid: newVaultUuid, joiner_terms: terms };

  const { error } = await supabase
    .from("rooms")
    .update(update)
    .eq("id", roomId);

  if (error) throw error;
}