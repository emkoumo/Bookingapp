import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolvePricing, parseNightlyPrices } from '@/lib/bookingPricing'
import { isBookingChannel, type NightPrice } from '@/lib/pricing'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            business: true,
          },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Remove propertyId from body as it cannot be updated (it's a relation field).
    // The pricing inputs are pulled out too, so they never reach the update
    // directly — they are always passed through resolvePricing first.
    const { propertyId, nightlyPrices, incomeOverride, ...updateData } = body

    const existing = await prisma.booking.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // An edit that carries a totalPrice was priced by hand, so keep the orange
    // flag. Once custom, always custom — we never clear it here.
    const setsPrice = body.totalPrice !== undefined && body.totalPrice !== null

    // The channel after this edit; absent from the body means unchanged.
    const nextSource: string = body.source ?? existing.source
    const channelIsBooking = isBookingChannel(nextSource)

    // Prices are only recomputed when the client actually sent a snapshot or a
    // net correction. Editing a phone number must leave the frozen prices alone.
    const sentSnapshot = parseNightlyPrices(nightlyPrices) !== null
    const sentOverride = incomeOverride !== undefined

    let pricingData: Record<string, unknown> = {}
    if (sentSnapshot || sentOverride) {
      // When only the net was corrected, fall back to the stored snapshot so a
      // net edit need not resend every night.
      const basis = sentSnapshot
        ? nightlyPrices
        : ((existing.nightlyPrices as unknown as NightPrice[] | null) ?? null)

      const pricing = await resolvePricing({
        propertyId: existing.propertyId,
        source: nextSource,
        nightlyPricesRaw: basis,
        incomeOverrideRaw: sentOverride ? incomeOverride : existing.incomeOverride,
      })

      if (pricing.nightlyPrices) {
        pricingData = {
          nightlyPrices: pricing.nightlyPrices,
          income: pricing.income,
          incomeOverride: pricing.incomeOverride,
          guestPaid: pricing.guestPaid,
          commissionPercent: pricing.commissionPercent,
          // Point (a): totalPrice follows income, so they can never disagree.
          totalPrice: pricing.totalPrice,
        }
      }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...updateData,
        checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
        checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
        advancePaymentDate: body.advancePaymentDate ? new Date(body.advancePaymentDate) : undefined,
        hasCustomPrice: setsPrice ? true : undefined,
        ...pricingData,
        // Point (b): Booking settles by bank transfer, so an advance on this
        // channel would present as money still owed. Cleared here, untouched on
        // every other channel.
        ...(channelIsBooking
          ? { advancePayment: null, remainingBalance: null, advancePaymentMethod: null, advancePaymentDate: null }
          : {}),
      },
      include: {
        property: {
          include: {
            business: true,
          },
        },
      },
    })

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error updating booking:', error)
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.booking.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting booking:', error)
    return NextResponse.json(
      { error: 'Failed to delete booking' },
      { status: 500 }
    )
  }
}
