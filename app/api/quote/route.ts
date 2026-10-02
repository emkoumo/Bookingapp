import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Availability + price quote for a date range, for one business's properties.
 *
 * Read-only: four finds and some arithmetic. It writes nothing, so it can never
 * affect a reservation or a price.
 *
 *   GET /api/quote?businessId=...&checkIn=2027-07-12&checkOut=2027-07-17
 *
 * checkOut is exclusive, matching reservations: 12 → 17 July is 5 nights
 * (12,13,14,15,16). Price ranges store their last night inclusively, which is
 * handled here rather than pushed onto the caller.
 */

/** Days since epoch for a yyyy-MM-dd or ISO string. */
function toDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

function dayToIso(day: number): string {
  return new Date(day * 86400000).toISOString().slice(0, 10)
}

type Segment = {
  from: string
  to: string
  nights: number
  pricePerNight: number
  subtotal: number
  /** Period label, when the covering range has one. */
  name: string | null
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const businessId = sp.get('businessId')
    const checkIn = sp.get('checkIn')
    const checkOut = sp.get('checkOut')

    if (!businessId || !checkIn || !checkOut) {
      return NextResponse.json({ error: 'businessId, checkIn και checkOut απαιτούνται' }, { status: 400 })
    }

    const first = toDay(checkIn)
    const end = toDay(checkOut) // exclusive
    const nights = end - first

    if (!Number.isFinite(first) || !Number.isFinite(end) || nights <= 0) {
      return NextResponse.json({ error: 'Η ημερομηνία αναχώρησης πρέπει να είναι μετά την άφιξη' }, { status: 400 })
    }
    const lastNight = end - 1

    const windowStart = new Date(first * 86400000)
    const windowEndExclusive = new Date(end * 86400000)

    const [properties, bookings, blocked, ranges] = await Promise.all([
      prisma.property.findMany({
        where: { businessId },
        include: { business: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
      // A stay conflicts when it starts before our checkout and ends after our
      // check-in; touching checkout/check-in days is not a conflict.
      prisma.booking.findMany({
        where: {
          status: 'active',
          property: { businessId },
          checkIn: { lt: windowEndExclusive },
          checkOut: { gt: windowStart },
        },
        select: { propertyId: true, customerName: true, checkIn: true, checkOut: true },
      }),
      // BlockedDate stores startDate..endDate inclusive.
      prisma.blockedDate.findMany({
        where: {
          property: { businessId },
          startDate: { lte: new Date(lastNight * 86400000) },
          endDate: { gte: windowStart },
        },
        select: { propertyId: true, startDate: true, endDate: true, reason: true },
      }),
      prisma.priceRange.findMany({
        where: {
          property: { businessId },
          dateFrom: { lte: new Date(lastNight * 86400000) },
          dateTo: { gte: windowStart },
        },
        select: { propertyId: true, dateFrom: true, dateTo: true, pricePerNight: true, name: true },
      }),
    ])

    const result = properties.map((p) => {
      const conflicts = [
        ...bookings
          .filter((b) => b.propertyId === p.id)
          .map((b) => ({
            type: 'booking' as const,
            label: b.customerName,
            from: b.checkIn.toISOString().slice(0, 10),
            to: b.checkOut.toISOString().slice(0, 10),
          })),
        ...blocked
          .filter((bd) => bd.propertyId === p.id)
          .map((bd) => ({
            type: 'blocked' as const,
            label: bd.reason || 'Κλειδωμένο',
            from: bd.startDate.toISOString().slice(0, 10),
            to: bd.endDate.toISOString().slice(0, 10),
          })),
      ]

      // Price every night from this property's own list, then merge runs of
      // nights that share a range into one line for the breakdown.
      const mine = ranges.filter((r) => r.propertyId === p.id)
      const segments: Segment[] = []
      const missingDates: string[] = []

      for (let d = first; d <= lastNight; d++) {
        const cell = new Date(d * 86400000)
        const hit = mine.find((r) => cell >= r.dateFrom && cell <= r.dateTo)
        if (!hit) {
          missingDates.push(dayToIso(d))
          continue
        }
        const price = Number(hit.pricePerNight)
        const tail = segments[segments.length - 1]
        if (tail && tail.pricePerNight === price && tail.name === (hit.name ?? null) && toDay(tail.to) === d - 1) {
          tail.to = dayToIso(d)
          tail.nights += 1
          tail.subtotal = Math.round(tail.pricePerNight * tail.nights * 100) / 100
        } else {
          segments.push({
            from: dayToIso(d),
            to: dayToIso(d),
            nights: 1,
            pricePerNight: price,
            subtotal: price,
            name: hit.name ?? null,
          })
        }
      }

      const total =
        missingDates.length > 0
          ? null
          : Math.round(segments.reduce((s, x) => s + x.subtotal, 0) * 100) / 100

      return {
        id: p.id,
        name: p.name,
        businessId: p.business.id,
        businessName: p.business.name,
        available: conflicts.length === 0,
        conflicts,
        total,
        pricePerNight: total === null ? null : Math.round((total / nights) * 100) / 100,
        segments,
        missingDates,
      }
    })

    return NextResponse.json({
      checkIn: dayToIso(first),
      checkOut: dayToIso(end),
      lastNight: dayToIso(lastNight),
      nights,
      totalProperties: result.length,
      availableCount: result.filter((r) => r.available).length,
      properties: result,
    })
  } catch (error) {
    console.error('Error building quote:', error)
    return NextResponse.json({ error: 'Αποτυχία υπολογισμού προσφοράς' }, { status: 500 })
  }
}
