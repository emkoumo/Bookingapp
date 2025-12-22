import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch all price ranges for a property
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const propertyId = searchParams.get('propertyId')

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      )
    }

    const priceRanges = await prisma.priceRange.findMany({
      where: { propertyId },
      orderBy: { dateFrom: 'asc' }
    })

    return NextResponse.json(priceRanges)
  } catch (error) {
    console.error('Error fetching price ranges:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price ranges' },
      { status: 500 }
    )
  }
}

// POST - Create new price range
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { propertyId, dateFrom, dateTo, pricePerNight } = body

    // Validation
    if (!propertyId || !dateFrom || !dateTo || !pricePerNight) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Parse dates and normalize to UTC midnight to avoid timezone issues
    const dateFromParsed = new Date(dateFrom + 'T00:00:00.000Z')
    const dateToParsed = new Date(dateTo + 'T23:59:59.999Z')

    // Validate date range
    if (dateToParsed <= dateFromParsed) {
      return NextResponse.json(
        { error: 'Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη' },
        { status: 400 }
      )
    }

    // Validate price
    if (parseFloat(pricePerNight) <= 0) {
      return NextResponse.json(
        { error: 'Η τιμή πρέπει να είναι μεγαλύτερη από 0' },
        { status: 400 }
      )
    }

    // Check for overlapping date ranges
    // Two ranges overlap if: (Start1 <= End2) AND (End1 >= Start2)
    const hasOverlap = await prisma.priceRange.findFirst({
      where: {
        propertyId,
        AND: [
          { dateFrom: { lte: dateToParsed } },
          { dateTo: { gte: dateFromParsed } }
        ]
      }
    })

    if (hasOverlap) {
      return NextResponse.json(
        { error: 'Οι ημερομηνίες επικαλύπτονται με υπάρχοντα τιμοκατάλογο' },
        { status: 400 }
      )
    }

    // Create price range
    const priceRange = await prisma.priceRange.create({
      data: {
        propertyId,
        dateFrom: dateFromParsed,
        dateTo: dateToParsed,
        pricePerNight: parseFloat(pricePerNight)
      }
    })

    return NextResponse.json(priceRange, { status: 201 })
  } catch (error) {
    console.error('Error creating price range:', error)
    return NextResponse.json(
      { error: 'Failed to create price range' },
      { status: 500 }
    )
  }
}

// PUT - Update existing price range
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, dateFrom, dateTo, pricePerNight } = body

    // Validation
    if (!id || !dateFrom || !dateTo || !pricePerNight) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Parse dates and normalize to UTC midnight to avoid timezone issues
    const dateFromParsed = new Date(dateFrom + 'T00:00:00.000Z')
    const dateToParsed = new Date(dateTo + 'T23:59:59.999Z')

    // Validate date range
    if (dateToParsed <= dateFromParsed) {
      return NextResponse.json(
        { error: 'Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη' },
        { status: 400 }
      )
    }

    // Validate price
    if (parseFloat(pricePerNight) <= 0) {
      return NextResponse.json(
        { error: 'Η τιμή πρέπει να είναι μεγαλύτερη από 0' },
        { status: 400 }
      )
    }

    // Get existing price range to find propertyId
    const existing = await prisma.priceRange.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Price range not found' },
        { status: 404 }
      )
    }

    // Check for overlaps (excluding current range)
    const hasOverlap = await prisma.priceRange.findFirst({
      where: {
        propertyId: existing.propertyId,
        id: { not: id },
        AND: [
          { dateFrom: { lte: dateToParsed } },
          { dateTo: { gte: dateFromParsed } }
        ]
      }
    })

    if (hasOverlap) {
      return NextResponse.json(
        { error: 'Οι ημερομηνίες επικαλύπτονται με υπάρχοντα τιμοκατάλογο' },
        { status: 400 }
      )
    }

    // Update price range
    const priceRange = await prisma.priceRange.update({
      where: { id },
      data: {
        dateFrom: dateFromParsed,
        dateTo: dateToParsed,
        pricePerNight: parseFloat(pricePerNight)
      }
    })

    return NextResponse.json(priceRange)
  } catch (error) {
    console.error('Error updating price range:', error)
    return NextResponse.json(
      { error: 'Failed to update price range' },
      { status: 500 }
    )
  }
}

// DELETE - Remove price range
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Price range ID is required' },
        { status: 400 }
      )
    }

    await prisma.priceRange.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting price range:', error)
    return NextResponse.json(
      { error: 'Failed to delete price range' },
      { status: 500 }
    )
  }
}
