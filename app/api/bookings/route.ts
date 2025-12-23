import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eachDayOfInterval, parseISO, format } from 'date-fns'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      )
    }

    const bookings = await prisma.booking.findMany({
      where: {
        property: {
          businessId,
        },
      },
      include: {
        property: {
          include: {
            business: true,
          },
        },
      },
      orderBy: { checkIn: 'desc' },
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      propertyId,
      customerName,
      contactInfo,
      contactChannel,
      checkIn,
      checkOut,
      deposit,
      notes,
      status,
      totalPrice,
      advancePayment,
      remainingBalance,
      advancePaymentMethod,
      advancePaymentDate
    } = body

    if (!propertyId || !customerName || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check for overlapping bookings
    const overlapping = await prisma.booking.findFirst({
      where: {
        propertyId,
        status: 'active',
        OR: [
          {
            AND: [
              { checkIn: { lte: new Date(checkIn) } },
              { checkOut: { gt: new Date(checkIn) } },
            ],
          },
          {
            AND: [
              { checkIn: { lt: new Date(checkOut) } },
              { checkOut: { gte: new Date(checkOut) } },
            ],
          },
          {
            AND: [
              { checkIn: { gte: new Date(checkIn) } },
              { checkOut: { lte: new Date(checkOut) } },
            ],
          },
        ],
      },
    })

    if (overlapping) {
      return NextResponse.json(
        { error: 'Υπάρχει ήδη κράτηση για αυτές τις ημερομηνίες' },
        { status: 409 }
      )
    }

    // Price validation: Only validate if totalPrice is not provided (custom price case)
    let calculatedTotal = 0

    if (!totalPrice) {
      // Only validate prices from database if no custom totalPrice is provided
      const checkInDate = parseISO(checkIn)
      const checkOutDate = parseISO(checkOut)

      const dates = eachDayOfInterval({
        start: checkInDate,
        end: new Date(checkOutDate.getTime() - 24 * 60 * 60 * 1000) // Exclude checkout day
      })

      const missingDates: string[] = []

      for (const date of dates) {
        const priceRange = await prisma.priceRange.findFirst({
          where: {
            propertyId,
            AND: [
              { dateFrom: { lte: date } },
              { dateTo: { gte: date } }
            ]
          }
        })

        if (!priceRange) {
          missingDates.push(format(date, 'yyyy-MM-dd'))
        } else {
          calculatedTotal += parseFloat(priceRange.pricePerNight.toString())
        }
      }

      // If any dates are missing prices, block the booking
      if (missingDates.length > 0) {
        return NextResponse.json(
          {
            error: 'Δεν υπάρχουν τιμές για όλες τις ημερομηνίες',
            missingDates
          },
          { status: 400 }
        )
      }
    }

    // Create booking with calculated prices
    const booking = await prisma.booking.create({
      data: {
        propertyId,
        customerName,
        contactInfo: contactInfo || null,
        contactChannel: contactChannel || null,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        deposit: deposit || null,
        notes: notes || null,
        status: status || 'active',
        totalPrice: totalPrice || calculatedTotal,
        advancePayment: advancePayment || null,
        remainingBalance: remainingBalance || (totalPrice ? totalPrice - (advancePayment || 0) : calculatedTotal),
        advancePaymentMethod: advancePaymentMethod || null,
        advancePaymentDate: advancePaymentDate ? new Date(advancePaymentDate) : null
      },
      include: {
        property: {
          include: {
            business: true,
          },
        },
      },
    })

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}
