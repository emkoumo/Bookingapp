import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recalculateBookingsForProperty } from '@/lib/recalculateBookings'

/**
 * Copy a season's price list forward into the next year, optionally with a
 * percentage uplift.
 *
 * Strictly additive by design:
 *  - It only ever CREATES rows in the target year. No existing PriceRange is
 *    updated or deleted, so last season's prices can never be damaged by this.
 *  - It refuses outright if the target year already holds any entry for these
 *    properties, rather than merging into it — that avoids both duplicates and
 *    tripping the overlap guard halfway through.
 *  - Creates run in one transaction, so a partial copy cannot be left behind.
 *
 * Recalculation runs once per property afterwards (not once per created row),
 * and bookings carrying hasCustomPrice are skipped by that function, so
 * manually-priced bookings in the target year are untouched.
 */

/** Last day of a month, 1-indexed month. */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Same month and day, different year — clamped to the month's length so
 * copying a 29 February from a leap year lands on the 28th instead of
 * rolling into March.
 */
function shiftYear(date: Date, toYear: number, endOfDay: boolean): Date {
  const month = date.getUTCMonth() + 1
  const day = Math.min(date.getUTCDate(), lastDayOfMonth(toYear, month))
  return endOfDay
    ? new Date(Date.UTC(toYear, month - 1, day, 23, 59, 59, 999))
    : new Date(Date.UTC(toYear, month - 1, day, 0, 0, 0, 0))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, fromYear, toYear, upliftPercent } = body

    const from = Number(fromYear)
    const to = Number(toYear)
    const uplift = upliftPercent === undefined || upliftPercent === null ? 0 : Number(upliftPercent)

    if (!businessId || !Number.isInteger(from) || !Number.isInteger(to)) {
      return NextResponse.json({ error: 'businessId, fromYear και toYear απαιτούνται' }, { status: 400 })
    }
    if (from === to) {
      return NextResponse.json({ error: 'Οι χρονιές πρέπει να διαφέρουν' }, { status: 400 })
    }
    if (!Number.isFinite(uplift) || uplift < -100 || uplift > 1000) {
      return NextResponse.json({ error: 'Μη έγκυρο ποσοστό' }, { status: 400 })
    }

    const properties = await prisma.property.findMany({
      where: { businessId },
      select: { id: true },
    })
    if (properties.length === 0) {
      return NextResponse.json({ error: 'Δεν βρέθηκαν καταλύματα' }, { status: 404 })
    }
    const propertyIds = properties.map((p) => p.id)

    const sourceStart = new Date(Date.UTC(from, 0, 1))
    const sourceEnd = new Date(Date.UTC(from, 11, 31, 23, 59, 59, 999))
    const targetStart = new Date(Date.UTC(to, 0, 1))
    const targetEnd = new Date(Date.UTC(to, 11, 31, 23, 59, 59, 999))

    // Refuse rather than merge — see the note above.
    const existing = await prisma.priceRange.count({
      where: {
        propertyId: { in: propertyIds },
        dateFrom: { gte: targetStart, lte: targetEnd },
      },
    })
    if (existing > 0) {
      return NextResponse.json(
        {
          error: `Το ${to} έχει ήδη ${existing} καταχωρήσεις. Διαγράψτε τις πρώτα αν θέλετε να αντιγράψετε ξανά.`,
        },
        { status: 409 }
      )
    }

    const source = await prisma.priceRange.findMany({
      where: {
        propertyId: { in: propertyIds },
        dateFrom: { gte: sourceStart, lte: sourceEnd },
      },
    })
    if (source.length === 0) {
      return NextResponse.json({ error: `Δεν υπάρχουν τιμές για το ${from}` }, { status: 404 })
    }

    const factor = 1 + uplift / 100
    const rows = source.map((r) => ({
      propertyId: r.propertyId,
      dateFrom: shiftYear(r.dateFrom, to, false),
      dateTo: shiftYear(r.dateTo, to, true),
      pricePerNight: Math.round(Number(r.pricePerNight) * factor * 100) / 100,
    }))

    // Guard against a zero/negative price sneaking in via a -100% uplift.
    if (rows.some((r) => r.pricePerNight <= 0)) {
      return NextResponse.json({ error: 'Το ποσοστό παράγει μη έγκυρες τιμές' }, { status: 400 })
    }

    await prisma.$transaction(rows.map((data) => prisma.priceRange.create({ data })))

    // Once per property, not once per row.
    const touched = Array.from(new Set(rows.map((r) => r.propertyId)))
    for (const propertyId of touched) {
      // Scoped to the season we just created, so bookings in any other year are
      // not even fetched, let alone rewritten.
      await recalculateBookingsForProperty(propertyId, { from: targetStart, to: targetEnd })
    }

    return NextResponse.json(
      { created: rows.length, fromYear: from, toYear: to, upliftPercent: uplift, properties: touched.length },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error copying price ranges:', error)
    return NextResponse.json({ error: 'Αποτυχία αντιγραφής τιμοκαταλόγου' }, { status: 500 })
  }
}
