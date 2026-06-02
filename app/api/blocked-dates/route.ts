import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBusinessAccess, authErrorResponse } from '@/lib/auth'

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

    await requireBusinessAccess(businessId)

    const blockedDates = await prisma.blockedDate.findMany({
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
      orderBy: { startDate: 'asc' },
    })

    return NextResponse.json(blockedDates)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error fetching blocked dates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blocked dates' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { propertyIds, startDate, endDate, reason } = body

    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one property ID is required' },
        { status: 400 }
      )
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    // Verify the user has access to every business that owns the supplied properties
    const properties = await prisma.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true, businessId: true },
    })

    if (properties.length !== propertyIds.length) {
      return NextResponse.json(
        { error: 'One or more properties not found' },
        { status: 404 }
      )
    }

    const businessIds = Array.from(new Set(properties.map((p) => p.businessId)))
    for (const bId of businessIds) {
      await requireBusinessAccess(bId)
    }

    // Validate date range
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      return NextResponse.json(
        { error: 'Η ημερομηνία λήξης πρέπει να είναι μετά την ημερομηνία έναρξης' },
        { status: 400 }
      )
    }

    // Check for overlapping active bookings for each property
    const conflictingBookings = []

    for (const propertyId of propertyIds) {
      const overlapping = await prisma.booking.findFirst({
        where: {
          propertyId,
          status: 'active',
          OR: [
            {
              AND: [
                { checkIn: { lte: new Date(startDate) } },
                { checkOut: { gt: new Date(startDate) } },
              ],
            },
            {
              AND: [
                { checkIn: { lt: new Date(endDate) } },
                { checkOut: { gte: new Date(endDate) } },
              ],
            },
            {
              AND: [
                { checkIn: { gte: new Date(startDate) } },
                { checkOut: { lte: new Date(endDate) } },
              ],
            },
          ],
        },
        include: {
          property: true,
        },
      })

      if (overlapping) {
        const property = await prisma.property.findUnique({
          where: { id: propertyId },
        })
        conflictingBookings.push(property?.name || propertyId)
      }
    }

    if (conflictingBookings.length > 0) {
      return NextResponse.json(
        {
          error: `Υπάρχουν ενεργές κρατήσεις για τα ακόλουθα καταλύματα: ${conflictingBookings.join(', ')}`
        },
        { status: 409 }
      )
    }

    // Create blocked dates for all properties
    const blockedDates = await Promise.all(
      propertyIds.map((propertyId) =>
        prisma.blockedDate.create({
          data: {
            propertyId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason: reason || null,
          },
          include: {
            property: {
              include: {
                business: true,
              },
            },
          },
        })
      )
    )

    return NextResponse.json(blockedDates, { status: 201 })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error creating blocked dates:', error)
    return NextResponse.json(
      { error: 'Failed to create blocked dates' },
      { status: 500 }
    )
  }
}
