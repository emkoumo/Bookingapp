'use client'

import { isBookingCom, guestSummary } from '@/lib/bookingSource'

/**
 * Channel and party size, shown in the bookings list, the reports page and the
 * PDF export.
 *
 * Three variants are rendered, and only ever one is visible:
 *
 *  - mobile: full-width boxes matching the notes/total rows in the card
 *  - desktop: compact inline pills, for the dense tables
 *  - PDF: plain text, because the reports page hides `.pdf-badge` and reveals
 *    `.pdf-text` while html2canvas captures the page; badges render unreliably
 *    into the canvas, and without this twin the Booking.com marker would
 *    vanish from the export.
 *
 * The PDF twin carries Tailwind's `hidden` as well as `.pdf-text`. The
 * `.pdf-text { display: none }` rule lives in the reports page's own <style>
 * block, so relying on it alone left the twin visible on the bookings page —
 * which is what caused it to render twice.
 */

type MetaBooking = {
  source?: string | null
  notes?: string | null
  adults?: number | null
  children?: number | null
}

function ChannelIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5zm0 7.5L4.5 6 12 3.5 19.5 6 12 9.5zM2 17l10 5 10-5v-7l-10 5-10-5v7z" />
    </svg>
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
  const bookingCom = isBookingCom(booking)
  const summary = guestSummary(booking)
  if (!bookingCom && !summary) return null

  const plain = [bookingCom ? 'Booking.com' : null, summary].filter(Boolean).join(' — ')

  return (
    <>
      {/* Mobile: full-width boxes, same weight as the notes and total rows */}
      <div className="pdf-badge md:hidden space-y-2 mb-2">
        {bookingCom && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
            <ChannelIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-bold text-blue-800">Booking.com</span>
          </div>
        )}
        {summary && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            <GuestsIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">{summary}</span>
          </div>
        )}
      </div>

      {/* Desktop: compact pills for the dense tables */}
      <div className="pdf-badge hidden md:flex flex-wrap items-center gap-1.5 mb-2">
        {bookingCom && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap bg-blue-100 text-blue-800 border border-blue-300"
            title="Κράτηση από Booking.com"
          >
            <ChannelIcon className="w-3 h-3" />
            <span>Booking.com</span>
          </span>
        )}
        {summary && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap bg-gray-100 text-gray-700 border border-gray-300">
            <GuestsIcon className="w-3 h-3" />
            <span>{summary}</span>
          </span>
        )}
      </div>

      {/* PDF export only — `hidden` keeps it out of the way on every page */}
      <div className="pdf-text hidden text-xs font-semibold text-blue-800 mb-2">{plain}</div>
    </>
  )
}
