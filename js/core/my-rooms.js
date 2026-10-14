// js/core/my-rooms.js
// One place that answers "which rooms does this person run or work in?"
// Used by the till, the daily sheet, upload-product, open-room and the seller
// dashboard, so one owner can run several businesses (rooms) everywhere.
import { supabase } from "./supabase-client.js";

const ROOM_COLS = "id, room_number, name, banner_emoji, category, status, seller_id";

// Returns { rooms, error }. Each room: the columns above plus
//   isOwner  - this person owns the room
//   roles    - room_roles held here (ROOM_OWNER / ROOM_MANAGER / EMPLOYEE ...)
//   canVoid  - owner or ROOM_MANAGER (the server enforces this too)
export async function loadMyRooms(userId) {
  const [owned, staffed] = await Promise.all([
    supabase
      .from("rooms")
      .select(ROOM_COLS)
      .eq("seller_id", userId)
      .order("room_number", { ascending: true }),
    supabase.from("room_roles").select(`room_id, role_id, rooms(${ROOM_COLS})`).eq("user_id", userId),
  ]);

  if (owned.error) console.error("[BSTM] Couldn't load owned rooms:", owned.error);
  if (staffed.error) console.error("[BSTM] Couldn't load staffed rooms:", staffed.error);

  const byId = new Map();
  for (const r of owned.data || []) {
    byId.set(r.id, { ...r, isOwner: true, roles: ["ROOM_OWNER"] });
  }
  for (const row of staffed.data || []) {
    const room = row.rooms;
    if (!room) continue;
    const entry = byId.get(room.id) || { ...room, isOwner: room.seller_id === userId, roles: [] };
    if (!entry.roles.includes(row.role_id)) entry.roles.push(row.role_id);
    byId.set(room.id, entry);
  }

  const rooms = Array.from(byId.values()).sort((a, b) => (a.room_number || 0) - (b.room_number || 0));
  rooms.forEach((r) => {
    r.canVoid = r.isOwner || r.roles.includes("ROOM_MANAGER");
  });
  return { rooms, error: owned.error || staffed.error || null };
}

// The room named by id if the person has it, otherwise their first room.
export function pickRoom(rooms, wantedId) {
  if (!rooms || rooms.length === 0) return null;
  return rooms.find((r) => r.id === wantedId) || rooms[0];
}

export function roomIdFromUrl() {
  return new URLSearchParams(window.location.search).get("room");
}

// Botswana has no daylight saving: Africa/Gaborone is always UTC+02:00.
export const TZ = "Africa/Gaborone";

export function gaboroneDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function money(n) {
  return "P" + Number(n || 0).toFixed(2);
}
