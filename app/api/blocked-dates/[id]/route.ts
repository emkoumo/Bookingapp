import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const blockedDate = await prisma.blockedDate.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            business: true,
          },
        },
      },
    })

    if (!blockedDate) {
      return NextResponse.json(
        { error: 'Blocked date not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(blockedDate)
  } catch (error) {
    console.error('Error fetching blocked date:', error)
    return NextResponse.json(
      { error: 'Failed to fetch blocked date' },
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
    const { startDate, endDate, reason } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
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

    // Get the blocked date to check its property
    const existingBlockedDate = await prisma.blockedDate.findUnique({
      where: { id },
    })

    if (!existingBlockedDate) {
      return NextResponse.json(
        { error: 'Blocked date not found' },
        { status: 404 }
      )
    }

    // Check for overlapping active bookings (excluding the current blocked date)
    const overlapping = await prisma.booking.findFirst({
      where: {
        propertyId: existingBlockedDate.propertyId,
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
      return NextResponse.json(
        { error: `Υπάρχει ενεργή κράτηση για το ${overlapping.property.name}` },
        { status: 409 }
      )
    }

    // Update blocked date
    const updatedBlockedDate = await prisma.blockedDate.update({
      where: { id },
      data: {
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

    return NextResponse.json(updatedBlockedDate)
  } catch (error) {
    console.error('Error updating blocked date:', error)
    return NextResponse.json(
      { error: 'Failed to update blocked date' },
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
    await prisma.blockedDate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting blocked date:', error)
    return NextResponse.json(
      { error: 'Failed to delete blocked date' },
      { status: 500 }
    )
  }
}
