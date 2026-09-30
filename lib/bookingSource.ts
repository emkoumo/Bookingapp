/**
 * Booking channel and party size — shared so the list, the reports page and the
 * PDF export all describe a booking the same way.
 *
 * Before these existed, both facts lived in the free-text `notes` field: a 🛑
 * marked a Booking.com reservation and the party was written out by hand
 * ("3 Ενήλικες - 2 παιδιά (9 και 15 ετών)"). `notes` is NOT replaced by any of
 * this — it still carries everything the structured fields cannot hold (ages,
 * cots, pets, payment scribbles), and it is still displayed in full.
 */

export const BOOKING_COM = 'booking_com'
export const MANUAL = 'manual'

/** The marker used by hand in notes before there was a channel field. */
export const LEGACY_BOOKING_COM_MARKER = '🛑'

export function isBookingCom(booking: { source?: string | null; notes?: string | null }): boolean {
  if (booking.source === BOOKING_COM) return true
  // Fall back to the legacy marker so the 17 bookings that only carry a 🛑 in
  // their notes are still recognised, with or without a backfill.
  return Boolean(booking.notes?.includes(LEGACY_BOOKING_COM_MARKER))
}

/**
 * Compact party summary, e.g. "2 ενήλικες · 3 παιδιά". Returns null when
 * neither count is recorded, so callers can fall back to the notes text rather
 * than print a misleading "0".
 */
export function guestSummary(booking: {
  adults?: number | null
  children?: number | null
}): string | null {
  const adults = booking.adults ?? null
  const children = booking.children ?? null
  if (adults === null && children === null) return null

  const parts: string[] = []
  if (adults !== null) parts.push(`${adults} ${adults === 1 ? 'ενήλικας' : 'ενήλικες'}`)
  if (children !== null && children > 0) parts.push(`${children} ${children === 1 ? 'παιδί' : 'παιδιά'}`)
  return parts.join(' · ')
}

/** Total heads, or null when nothing is recorded. */
export function guestTotal(booking: {
  adults?: number | null
  children?: number | null
}): number | null {
  if (booking.adults == null && booking.children == null) return null
  return (booking.adults ?? 0) + (booking.children ?? 0)
}

/** Options for the adults/children selects. */
export const ADULT_OPTIONS = Array.from({ length: 21 }, (_, i) => i)
export const CHILD_OPTIONS = Array.from({ length: 21 }, (_, i) => i)
