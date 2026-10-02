import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eachDayOfInterval, parseISO, format } from 'date-fns'
import {
  CHANNEL_BOOKING,
  DEFAULT_COMMISSION_PERCENT,
  DEFAULT_FEE_SETTINGS,
  bookingPriceToNet,
  computeClimateFee,
  computeGuestPaid,
  computeIncome,
  isBookingChannel,
  type NightPrice,
} from '@/lib/pricing'

/**
 * Price a stay for a given channel.
 *
 * `source` picks which column is read: the Booking channel uses the Extranet
 * price, everything else uses the Direct price. A night with no price for the
 * chosen channel is reported in `missingDates` — it is never quietly filled in
 * from the other channel, because that would understate or overstate the money.
 *
 * The returned per-night prices are always the NET. This is the one place
 * commission is applied: the Extranet 177 becomes 150.45 here, so every figure
 * downstream — the modal, the snapshot, the income — is already net and cannot
 * have commission taken off a second time.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { propertyId, checkIn, checkOut, source } = body

    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Property ID, check-in, and check-out dates are required' },
        { status: 400 }
      )
    }

    const checkInDate = parseISO(checkIn)
    const checkOutDate = parseISO(checkOut)

    if (checkOutDate <= checkInDate) {
      return NextResponse.json(
        { error: 'Η ημερομηνία αναχώρησης πρέπει να είναι μετά την άφιξη' },
        { status: 400 }
      )
    }

    const booking = isBookingChannel(source)

    // Settings are per business; a business with no row reads as the defaults.
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { businessId: true },
    })
    const settings = property
      ? await prisma.pricingSettings.findUnique({ where: { businessId: property.businessId } })
      : null

    const commissionPercent = settings ? Number(settings.commissionPercent) : DEFAULT_COMMISSION_PERCENT
    const feeSettings = settings
      ? {
          climateFeeHigh: Number(settings.climateFeeHigh),
          climateFeeLow: Number(settings.climateFeeLow),
          highSeasonStartMonth: settings.highSeasonStartMonth,
          highSeasonEndMonth: settings.highSeasonEndMonth,
        }
      : DEFAULT_FEE_SETTINGS

    // checkOut is exclusive — the checkout day is not a booked night.
    const dates = eachDayOfInterval({
      start: checkInDate,
      end: new Date(checkOutDate.getTime() - 24 * 60 * 60 * 1000),
    })

    const ranges = await prisma.priceRange.findMany({ where: { propertyId } })

    const breakdown: NightPrice[] = []
    const missingDates: string[] = []
    let gross = 0

    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd')
      const cell = new Date(dateStr + 'T00:00:00.000Z')
      const range = ranges.find((r) => cell >= r.dateFrom && cell <= r.dateTo)

      const raw = !range
        ? null
        : booking
          ? range.bookingPrice === null
            ? null
            // Commission comes off here, once. 177 -> 150.45.
            : bookingPriceToNet(Number(range.bookingPrice), commissionPercent)
          : Number(range.pricePerNight)

      if (raw === null) {
        missingDates.push(dateStr)
        continue
      }

      const price = Math.round(raw * 100) / 100
      breakdown.push({ date: dateStr, price })
      gross += price
    }

    const allNights = dates.map((d) => format(d, 'yyyy-MM-dd'))

    if (missingDates.length > 0) {
      // Deliberately NOT an early bail: breakdown and allNights come back too,
      // so the caller can collect a price by hand for the uncovered nights
      // rather than being blocked. Nothing is substituted from the other
      // channel's column.
      return NextResponse.json({
        success: false,
        channel: booking ? CHANNEL_BOOKING : 'manual',
        missingDates,
        // Named distinctly so the modal can say WHICH price is missing.
        missingReason: booking ? 'booking_price' : 'direct_price',
        breakdown,
        allNights,
        nightsCount: dates.length,
        message: booking
          ? 'Λείπει τιμή Booking για κάποιες ημερομηνίες'
          : 'Δεν υπάρχουν τιμές για όλες τις ημερομηνίες',
      })
    }

    const income = computeIncome({ nights: breakdown, source })
    const guestPaid = computeGuestPaid({ nights: breakdown, source, feeSettings, commissionPercent })
    const climateFee = computeClimateFee({ nights: breakdown, source, feeSettings })

    return NextResponse.json({
      success: true,
      channel: booking ? CHANNEL_BOOKING : 'manual',
      // Sum of the NET nightly prices, i.e. the income, on either channel.
      totalPrice: Math.round(gross * 100) / 100,
      nightsCount: dates.length,
      breakdown,
      allNights,
      income,
      guestPaid,
      climateFee,
      commissionPercent,
    })
  } catch (error) {
    console.error('Error calculating price:', error)
    return NextResponse.json({ error: 'Failed to calculate price' }, { status: 500 })
  }
}
