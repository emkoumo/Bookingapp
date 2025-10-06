import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const { propertyId, customerName, contactInfo, checkIn, checkOut, deposit, notes, status } = body

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

    const booking = await prisma.booking.create({
      data: {
        propertyId,
        customerName,
        contactInfo: contactInfo || null,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        deposit: deposit || null,
        notes: notes || null,
        status: status || 'active',
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
