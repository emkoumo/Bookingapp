'use client'

import { isBookingCom, guestSummary } from '@/lib/bookingSource'

/**
 * Channel badge and party size, rendered identically in the bookings list, the
 * reports page and therefore the PDF export (which is a canvas capture of the
 * reports markup).
 *
 * The badge carries a text label, not just a colour or an emoji: colour alone
 * fails for anyone who can't distinguish it, and emoji render inconsistently
 * through html2canvas into the PDF.
 */

type MetaBooking = {
  source?: string | null
  notes?: string | null
  adults?: number | null
  children?: number | null
}

export function SourceBadge({ booking, compact = false }: { booking: MetaBooking; compact?: boolean }) {
  if (!isBookingCom(booking)) return null
  return (
    <span
      className={`pdf-badge inline-flex items-center gap-1 rounded font-bold border whitespace-nowrap ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      } bg-blue-100 text-blue-800 border-blue-300`}
      title="Κράτηση από Booking.com"
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5zm0 7.5L4.5 6 12 3.5 19.5 6 12 9.5zM2 17l10 5 10-5v-7l-10 5-10-5v7z" />
      </svg>
      <span>Booking.com</span>
    </span>
  )
}

export function GuestBadge({ booking, compact = false }: { booking: MetaBooking; compact?: boolean }) {
  const summary = guestSummary(booking)
  if (!summary) return null
  return (
    <span
      className={`pdf-badge inline-flex items-center gap-1 rounded font-semibold border whitespace-nowrap ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      } bg-gray-100 text-gray-700 border-gray-300`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span>{summary}</span>
    </span>
  )
}

/**
 * Both badges in a row; renders nothing when neither applies.
 *
 * Two variants are emitted on purpose. The reports page hides `.pdf-badge` and
 * reveals `.pdf-text` while html2canvas captures the page, because pill badges
 * render unreliably into the canvas. Without the plain-text twin the
 * Booking.com marker would silently disappear from the PDF export — which is
 * where it is most needed.
 */
export default function BookingMeta({ booking, compact = false }: { booking: MetaBooking; compact?: boolean }) {
  const bookingCom = isBookingCom(booking)
  const summary = guestSummary(booking)
  if (!bookingCom && !summary) return null

  const plain = [bookingCom ? 'Booking.com' : null, summary].filter(Boolean).join(' — ')

  return (
    <div className={`mb-2 ${compact ? '' : ''}`}>
      {/* Screen */}
      <div className={`pdf-badge flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
        <SourceBadge booking={booking} compact={compact} />
        <GuestBadge booking={booking} compact={compact} />
      </div>
      {/* PDF export */}
      <div className="pdf-text text-xs font-semibold text-blue-800">{plain}</div>
    </div>
  )
}
