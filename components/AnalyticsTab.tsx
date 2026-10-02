'use client'

import { useState } from 'react'
import { displayIncome, displayAdvance } from '@/lib/bookingDisplay'

/**
 * Analytics view for the Reports page.
 *
 * Read-only: every figure is derived in the browser from bookings, blocked
 * dates and properties that the page has already fetched. Nothing here writes
 * to the database.
 *
 * Two families of metric, kept deliberately separate because they answer
 * different questions and mixing them produces numbers that look wrong:
 *
 *  - Night-level (occupancy, ADR, RevPAR, revenue): a booking counts only for
 *    the nights that actually fall inside the selected range, and its price is
 *    prorated to those nights. A stay crossing the range boundary contributes
 *    its overlap, not its whole value.
 *  - Booking-level (count, average value, average stay, lead time): counts
 *    whole bookings whose check-in falls inside the range.
 *
 * Dates are reduced to integer day numbers before any arithmetic, so overlaps
 * are plain integer maths and no timezone or DST edge case can shift a night.
 */

interface Property {
  id: string
  name: string
}

interface Booking {
  id: string
  checkIn: string
  checkOut: string
  status: string
  totalPrice?: number
  advancePayment?: number
  createdAt?: string
  source?: string | null
  income?: number | null
  property: { id: string; name: string }
}

interface BlockedDate {
  id: string
  startDate: string
  endDate: string
  property: { id: string; name: string }
}

interface Props {
  bookings: Booking[]
  properties: Property[]
  blockedDates: BlockedDate[]
  selectedProperty: string
  /** Selected season. Chips and the default window stay inside it. */
  year: number
  /** Set when the page's custom date range is on; overrides the period chips. */
  customRange: { start: string; end: string } | null
}

/** Days since epoch, from a yyyy-MM-dd or full ISO string. */
function toDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

function dayToDate(day: number): Date {
  return new Date(day * 86400000)
}

/** Inclusive-range overlap in whole nights. */
function overlapNights(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart) + 1)
}

const GREEK_MONTHS = [
  'Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν',
  'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ',
]

const euro = (n: number) =>
  '€' + n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const pct = (n: number) => (n * 100).toFixed(1) + '%'

export default function AnalyticsTab({
  bookings,
  properties,
  blockedDates,
  selectedProperty,
  year,
  customRange,
}: Props) {
  // 'all' is the default on purpose: the first thing you should see is the
  // whole picture, past and future together, not one half of it.
  const [period, setPeriod] = useState<string>('all')

  const scopedProperties =
    selectedProperty === 'all' ? properties : properties.filter((p) => p.id === selectedProperty)

  const active = bookings.filter(
    (b) => b.status === 'active' && (selectedProperty === 'all' || b.property.id === selectedProperty)
  )

  // Months the data touches *within the selected season*, oldest first.
  const monthChips: Array<{ key: string; label: string; start: string; end: string }> = []
  {
    const seen = new Set<string>()
    for (const b of active) {
      const bIn = toDay(b.checkIn)
      const bOut = toDay(b.checkOut)
      if (bOut - bIn <= 0) continue
      for (let d = bIn; d < bOut; d++) {
        const dt = dayToDate(d)
        if (dt.getUTCFullYear() !== year) continue
        const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
        if (seen.has(key)) continue
        seen.add(key)
      }
    }
    for (const key of Array.from(seen).sort()) {
      const [y, m] = key.split('-').map(Number)
      monthChips.push({
        key,
        label: `${GREEK_MONTHS[m - 1]} ${String(y).slice(2)}`,
        start: `${key}-01`,
        end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
      })
    }
  }

  // Resolve the active window: custom range wins, then a month chip, then the
  // full span of the data.
  let rangeStart = ''
  let rangeEnd = ''
  if (customRange && customRange.start && customRange.end) {
    rangeStart = customRange.start
    rangeEnd = customRange.end
  } else if (period !== 'all') {
    const chip = monthChips.find((c) => c.key === period)
    if (chip) {
      rangeStart = chip.start
      rangeEnd = chip.end
    }
  }
  if (!rangeStart && monthChips.length > 0) {
    rangeStart = monthChips[0].start
    rangeEnd = monthChips[monthChips.length - 1].end
  }

  const chips = (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
      {/* shrink-0 is what makes the row actually scroll: without it flex
          children compress to fit and the overflow never happens. */}
      <button
        onClick={() => setPeriod('all')}
        disabled={Boolean(customRange)}
        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${
          period === 'all' && !customRange
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Όλα
      </button>
      {monthChips.map((c) => (
        <button
          key={c.key}
          onClick={() => setPeriod(c.key)}
          disabled={Boolean(customRange)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${
            period === c.key && !customRange
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )

  if (!rangeStart || !rangeEnd) {
    return (
      <div className="px-4 py-4">
        {chips}
        <div className="py-12 text-center text-gray-500 text-sm">
          Δεν υπάρχουν κρατήσεις για ανάλυση.
        </div>
      </div>
    )
  }

  const from = toDay(rangeStart)
  const to = toDay(rangeEnd)

  if (to < from) {
    return (
      <div className="px-4 py-4">
        {chips}
        <div className="py-12 text-center text-gray-500 text-sm">
          Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη.
        </div>
      </div>
    )
  }

  const rangeNights = to - from + 1

  // ---- Night-level -------------------------------------------------------
  type Contribution = { nights: number; revenue: number; booking: Booking }

  const contributions: Contribution[] = []
  for (const b of active) {
    const bIn = toDay(b.checkIn)
    const bOut = toDay(b.checkOut)
    const stayNights = bOut - bIn
    if (stayNights <= 0) continue

    const nights = overlapNights(bIn, bOut - 1, from, to)
    if (nights === 0) continue

    // Income, so a Booking reservation contributes its net rather than gross.
    const total = displayIncome(b)
    contributions.push({ nights, revenue: (total * nights) / stayNights, booking: b })
  }

  const occupiedNights = contributions.reduce((s, c) => s + c.nights, 0)
  const revenueInRange = contributions.reduce((s, c) => s + c.revenue, 0)

  const scopedIds = new Set(scopedProperties.map((p) => p.id))
  const blockedNights = blockedDates
    .filter((bd) => scopedIds.has(bd.property.id))
    .reduce((s, bd) => s + overlapNights(toDay(bd.startDate), toDay(bd.endDate), from, to), 0)

  const capacityNights = scopedProperties.length * rangeNights
  // Never let blocked dates push capacity below what is demonstrably occupied.
  const availableNights = Math.max(occupiedNights, capacityNights - blockedNights)

  const occupancy = availableNights > 0 ? occupiedNights / availableNights : 0
  const adr = occupiedNights > 0 ? revenueInRange / occupiedNights : 0

  // ---- Booking-level -----------------------------------------------------
  const starting = active.filter((b) => {
    const bIn = toDay(b.checkIn)
    return bIn >= from && bIn <= to
  })

  const startingValue = starting.reduce((s, b) => s + displayIncome(b), 0)
  const startingNights = starting.reduce((s, b) => s + (toDay(b.checkOut) - toDay(b.checkIn)), 0)
  const avgBookingValue = starting.length > 0 ? startingValue / starting.length : 0
  const avgStay = starting.length > 0 ? startingNights / starting.length : 0

  const withCreated = starting.filter((b) => b.createdAt)
  const avgLeadTime =
    withCreated.length > 0
      ? withCreated.reduce((s, b) => s + (toDay(b.checkIn) - toDay(b.createdAt!)), 0) / withCreated.length
      : null

  const advances = starting.reduce((s, b) => s + (displayAdvance(b) ?? 0), 0)
  const outstanding = startingValue - advances

  // ---- Per-property ------------------------------------------------------
  const perProperty = scopedProperties
    .map((p) => {
      const rows = contributions.filter((c) => c.booking.property.id === p.id)
      const nights = rows.reduce((s, c) => s + c.nights, 0)
      const revenue = rows.reduce((s, c) => s + c.revenue, 0)
      const blocked = blockedDates
        .filter((bd) => bd.property.id === p.id)
        .reduce((s, bd) => s + overlapNights(toDay(bd.startDate), toDay(bd.endDate), from, to), 0)
      const avail = Math.max(nights, rangeNights - blocked)
      return {
        id: p.id,
        name: p.name,
        nights,
        revenue,
        occupancy: avail > 0 ? nights / avail : 0,
        adr: nights > 0 ? revenue / nights : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  // ---- Per-month ---------------------------------------------------------
  const months: Array<{ key: string; label: string; nights: number; revenue: number; occupancy: number }> = []
  {
    const start = dayToDate(from)
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
    const last = dayToDate(to)

    while (
      cursor.getUTCFullYear() < last.getUTCFullYear() ||
      (cursor.getUTCFullYear() === last.getUTCFullYear() && cursor.getUTCMonth() <= last.getUTCMonth())
    ) {
      const y = cursor.getUTCFullYear()
      const m = cursor.getUTCMonth()
      const mStart = Math.round(Date.UTC(y, m, 1) / 86400000)
      const mEnd = Math.round(Date.UTC(y, m + 1, 0) / 86400000)
      const wStart = Math.max(mStart, from)
      const wEnd = Math.min(mEnd, to)
      const wNights = wEnd - wStart + 1

      let nights = 0
      let revenue = 0
      for (const b of active) {
        const bIn = toDay(b.checkIn)
        const bOut = toDay(b.checkOut)
        const stayNights = bOut - bIn
        if (stayNights <= 0) continue
        const n = overlapNights(bIn, bOut - 1, wStart, wEnd)
        if (n === 0) continue
        nights += n
        revenue += (displayIncome(b) * n) / stayNights
      }

      const blocked = blockedDates
        .filter((bd) => scopedIds.has(bd.property.id))
        .reduce((s, bd) => s + overlapNights(toDay(bd.startDate), toDay(bd.endDate), wStart, wEnd), 0)
      const avail = Math.max(nights, scopedProperties.length * wNights - blocked)

      months.push({
        key: `${y}-${m}`,
        label: `${GREEK_MONTHS[m]} ${String(y).slice(2)}`,
        nights,
        revenue,
        occupancy: avail > 0 ? nights / avail : 0,
      })

      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }

  const peakMonth = months.reduce<(typeof months)[number] | null>(
    (best, m) => (best === null || m.occupancy > best.occupancy ? m : best),
    null
  )
  const maxMonthRevenue = Math.max(1, ...months.map((m) => m.revenue))

  return (
    <div className="px-4 py-4 space-y-6">
      {/* Period chips */}
      <section>
        {chips}
        <p className="mt-2 text-xs text-gray-500">
          {customRange
            ? 'Προσαρμοσμένο εύρος (από το φίλτρο πιο πάνω)'
            : period === 'all'
              ? `Σεζόν ${year} — όλη η χρονιά, παρελθόν και μέλλον (${rangeStart.slice(0, 7)} έως ${rangeEnd.slice(0, 7)})`
              : `${rangeStart} έως ${rangeEnd}`}
        </p>
      </section>

      {/* Hero: occupancy */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-700">Πληρότητα</h3>
          <span className="text-xs text-gray-500">
            {occupiedNights.toLocaleString('el-GR')} από {availableNights.toLocaleString('el-GR')} διαν.
          </span>
        </div>
        <div className="flex items-end gap-3 mb-3">
          <div className="text-5xl font-semibold text-gray-900 leading-none">{pct(occupancy)}</div>
          <div className="text-xs text-gray-500 pb-1">
            {scopedProperties.length} {scopedProperties.length === 1 ? 'κατάλυμα' : 'καταλύματα'} × {rangeNights} ημέρες
          </div>
        </div>
        {/* Meter: fill and track are steps of one hue */}
        <div className="h-3 w-full rounded-full overflow-hidden" style={{ backgroundColor: '#cde2fb' }}>
          <div
            className="h-full rounded-r"
            style={{ width: `${Math.min(100, occupancy * 100)}%`, backgroundColor: '#2a78d6' }}
          />
        </div>
        {blockedNights > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Εξαιρούνται {blockedNights.toLocaleString('el-GR')} κλειδωμένες διανυκτερεύσεις.
          </p>
        )}
      </section>

      {/* KPI row */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-3">Βασικοί δείκτες</h3>
        {/* One per row on mobile — these labels and hints need the width. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Tile
            label="Έσοδα περιόδου"
            value={euro(revenueInRange)}
            hint="Μόνο οι διαν. μέσα στο εύρος"
          />
          <Tile
            label="Μέση τιμή ανά διαν."
            value={euro(adr)}
            hint="Κατά μέσο όρο ανά γεμάτη βραδιά"
          />
          <Tile
            label="Κρατημένες διαν."
            value={`${occupiedNights.toLocaleString('el-GR')} (${pct(occupancy)})`}
            hint={`από ${availableNights.toLocaleString('el-GR')} διαθέσιμες`}
          />
        </div>
      </section>

      {/* Booking-level */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-1">Κρατήσεις που ξεκινούν στην περίοδο</h3>
        <p className="text-xs text-gray-500 mb-3">Ολόκληρες κρατήσεις με check-in εντός του εύρους.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Κρατήσεις" value={starting.length.toLocaleString('el-GR')} />
          <Tile label="Μέση αξία κράτησης" value={euro(avgBookingValue)} />
          <Tile label="Μέση διάρκεια" value={`${avgStay.toFixed(1)} διαν.`} />
          <Tile
            label="Μέσος χρόνος προκράτησης"
            value={avgLeadTime === null ? '—' : `${Math.round(avgLeadTime)} ημ.`}
            hint="Από καταχώρηση έως άφιξη"
          />
        </div>
      </section>

      {/* Payments. Deliberately separated and caveated: the schema records the
          deposit only, so "υπόλοιπο" means "not recorded as paid", which is not
          the same as "not paid". */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-1">Πληρωμές</h3>
        <p className="text-xs text-gray-500 mb-3">Για τις κρατήσεις που ξεκινούν στην περίοδο.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Tile label="Συνολική αξία" value={euro(startingValue)} />
          <Tile label="Προκαταβολές" value={euro(advances)} />
          <Tile label="Εξόφληση" value={euro(outstanding)} />
        </div>
      </section>

      {/* Per property */}
      {scopedProperties.length > 1 && (
        <section>
          <h3 className="text-sm font-bold text-gray-700 mb-3">Ανά κατάλυμα</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-semibold">Κατάλυμα</th>
                  <th className="py-2 pr-3 font-semibold">Πληρότητα</th>
                  <th className="py-2 pr-3 font-semibold text-right tabular-nums">Διαν.</th>
                  <th className="py-2 pr-3 font-semibold text-right tabular-nums">ADR</th>
                  <th className="py-2 font-semibold text-right tabular-nums">Έσοδα</th>
                </tr>
              </thead>
              <tbody>
                {perProperty.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-gray-900 whitespace-nowrap">{p.name}</td>
                    <td className="py-2 pr-3 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: '#cde2fb' }}>
                          <div
                            className="h-full rounded-r"
                            style={{ width: `${Math.min(100, p.occupancy * 100)}%`, backgroundColor: '#2a78d6' }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 tabular-nums w-12 text-right">{pct(p.occupancy)}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{p.nights}</td>
                    <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{euro(p.adr)}</td>
                    <td className="py-2 text-right font-semibold text-gray-900 tabular-nums">{euro(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Per month */}
      {months.length > 1 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700">Ανά μήνα</h3>
            {peakMonth && (
              <span className="text-xs text-gray-500">
                Κορύφωση: {peakMonth.label} ({pct(peakMonth.occupancy)})
              </span>
            )}
          </div>

          <div className="space-y-3">
            {months.map((m) => (
              <div key={m.key} className="flex items-center gap-3">
                <div className="w-16 shrink-0 text-xs text-gray-600">{m.label}</div>
                <div className="flex-1 min-w-0">
                  {/* Occupancy bar */}
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: '#cde2fb' }}>
                      <div
                        className="h-full rounded-r"
                        style={{ width: `${Math.min(100, m.occupancy * 100)}%`, backgroundColor: '#2a78d6' }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 tabular-nums w-12 text-right">{pct(m.occupancy)}</span>
                  </div>
                  {/* Revenue bar, its own scale, labelled — never a second axis on the bar above */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-r"
                        style={{ width: `${(m.revenue / maxMonthRevenue) * 100}%`, backgroundColor: '#9ec5f4' }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 tabular-nums w-20 text-right">{euro(m.revenue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Επάνω μπάρα: πληρότητα (0–100%). Κάτω μπάρα: έσοδα, σχετικά με τον καλύτερο μήνα.
          </p>
        </section>
      )}

      {occupiedNights === 0 && (
        <div className="py-8 text-center text-gray-500 text-sm">
          Δεν υπάρχουν διανυκτερεύσεις σε αυτό το εύρος.
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-500 leading-tight">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-400 leading-tight">{hint}</div>}
    </div>
  )
}
