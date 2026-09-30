'use client'

import { isBookingCom, guestSummary } from '@/lib/bookingSource'

/**
 * Channel mark and party size for a booking.
 *
 * The channel is a small square brand mark sitting beside the guest's name —
 * far quicker to scan down a list than a full-width row. It is deliberately
 * NOT tagged `.pdf-badge`, so unlike the pill badges it also survives into the
 * PDF export: it is a plain div with a background colour and a letter, which
 * html2canvas renders reliably (emoji and complex pills do not).
 *
 * Party size stays below the name, since it is detail rather than
 * identification: full-width on mobile to match the Σύνολο rows and the notes
 * box, a compact pill on desktop where the tables are dense.
 */

type MetaBooking = {
  source?: string | null
  notes?: string | null
  adults?: number | null
  children?: number | null
}

/** Booking.com brand blue. */
const BOOKING_BLUE = '#003b95'

/**
 * Square "B" mark, shown beside the name. Renders nothing for a direct booking,
 * so it can be dropped in unconditionally next to any customer name.
 */
export function BookingComLogo({ booking, size = 'md' }: { booking: MetaBooking; size?: 'sm' | 'md' }) {
  if (!isBookingCom(booking)) return null
  const box = size === 'sm' ? 'w-5 h-5 text-[11px]' : 'w-6 h-6 text-xs'
  return (
    <span
      className={`${box} flex-shrink-0 inline-flex items-center justify-center rounded font-extrabold text-white leading-none`}
      style={{ backgroundColor: BOOKING_BLUE }}
      title="Κράτηση από Booking.com"
      aria-label="Booking.com"
    >
      B
    </span>
  )
}

function GuestsIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}

export default function BookingMeta({ booking }: { booking: MetaBooking }) {
  const summary = guestSummary(booking)
  if (!summary) return null

  return (
    <>
      {/* Mobile: full-width, same weight as the notes box */}
      <div className="pdf-badge md:hidden mb-2">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
          <GuestsIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700">{summary}</span>
        </div>
      </div>

      {/* Desktop: compact pill */}
      <div className="pdf-badge hidden md:flex flex-wrap items-center gap-1.5 mb-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap bg-gray-100 text-gray-700 border border-gray-300">
          <GuestsIcon className="w-3 h-3" />
          <span>{summary}</span>
        </span>
      </div>

      {/* PDF export only. `hidden` applies everywhere; the reports page's
          .pdf-export-mode rule is !important and reveals it during capture. */}
      <div className="pdf-text hidden text-xs font-semibold text-gray-700 mb-2">{summary}</div>
    </>
  )
}
