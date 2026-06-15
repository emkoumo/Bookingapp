import { prisma } from './prisma'

/**
 * Recompute every booking on a property using the current price list.
 *
 * Called after a PriceRange is added, edited, or deleted, so all pages
 * (Calendar, Bookings list, Reports) show numbers that match the current
 * price list. Includes past bookings.
 *
 * Behaviour:
 *  - For each booking, sum the per-night price-list value for every night
 *    of the stay (checkout night not counted).
 *  - If any night has no matching PriceRange, the booking is SKIPPED
 *    (we don't zero it out, we keep whatever total was already saved).
 *  - extraBedTotal is preserved and added back into totalPrice.
 *  - remainingBalance is updated to (new total − advancePayment).
 *  - If the new total equals what's already saved, no DB write happens.
 *
 * NOTE: manual per-night overrides on bookings are reset to the price-list
 * value. This was the user's explicit choice when designing this feature.
 */
export async function recalculateBookingsForProperty(propertyId: string) {
  const [bookings, ranges] = await Promise.all([
    prisma.booking.findMany({ where: { propertyId } }),
    prisma.priceRange.findMany({ where: { propertyId } }),
  ])

  const summary = { updated: 0, skipped: 0, unchanged: 0 }

  for (const booking of bookings) {
    const roomTotal = computeRoomTotal(booking.checkIn, booking.checkOut, ranges)
    if (roomTotal === null) {
      summary.skipped++
      continue
    }

    const extraBed = booking.extraBedTotal ? Number(booking.extraBedTotal) : 0
    const newTotal = round2(roomTotal + extraBed)
    const advance = booking.advancePayment ? Number(booking.advancePayment) : 0
    const newRemaining = round2(newTotal - advance)

    const currentTotal = booking.totalPrice ? Number(booking.totalPrice) : 0
    if (Math.abs(currentTotal - newTotal) < 0.01) {
      summary.unchanged++
      continue
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        totalPrice: newTotal,
        remainingBalance: booking.advancePayment ? newRemaining : null,
      },
    })
    summary.updated++
  }

  return summary
}

function computeRoomTotal(
  checkIn: Date,
  checkOut: Date,
  ranges: Array<{ dateFrom: Date; dateTo: Date; pricePerNight: unknown }>
): number | null {
  const cursor = new Date(checkIn)
  cursor.setUTCHours(0, 0, 0, 0)
  const end = new Date(checkOut)
  end.setUTCHours(0, 0, 0, 0)

  let total = 0
  while (cursor < end) {
    const range = ranges.find(r => {
      const from = new Date(r.dateFrom)
      const to = new Date(r.dateTo)
      return cursor >= from && cursor <= to
    })
    if (!range) return null
    total += round2(Number(range.pricePerNight))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return round2(total)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
