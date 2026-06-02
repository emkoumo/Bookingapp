import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBusinessAccess, authErrorResponse } from '@/lib/auth'

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

    await requireBusinessAccess(booking.property.businessId)

    return NextResponse.json(booking)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
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

    const existing = await prisma.booking.findUnique({
      where: { id },
      include: { property: { select: { businessId: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    await requireBusinessAccess(existing.property.businessId)

    const body = await request.json()

    // Remove propertyId from body as it cannot be updated (it's a relation field)
    const { propertyId, ...updateData } = body

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...updateData,
        checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
        checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
        advancePaymentDate: body.advancePaymentDate ? new Date(body.advancePaymentDate) : undefined,
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
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
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

    const existing = await prisma.booking.findUnique({
      where: { id },
      include: { property: { select: { businessId: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    await requireBusinessAccess(existing.property.businessId)

    await prisma.booking.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error deleting booking:', error)
    return NextResponse.json(
      { error: 'Failed to delete booking' },
      { status: 500 }
    )
  }
}
