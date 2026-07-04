import type { RoomId } from '../types/dashboard'

/**
 * The only hardcoded business data allowed in the frontend: mapping the
 * backend room key to a human display name and a stable render order.
 */
export const ROOM_ORDER: RoomId[] = ['drawing', 'work1', 'work2']

const ROOM_NAMES: Record<RoomId, string> = {
  drawing: 'Drawing Room',
  work1: 'Work Room 1',
  work2: 'Work Room 2',
}

export function formatRoomName(room: RoomId | string): string {
  return ROOM_NAMES[room as RoomId] ?? room
}
