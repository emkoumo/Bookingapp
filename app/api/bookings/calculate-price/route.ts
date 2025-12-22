import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eachDayOfInterval, parseISO, format } from 'date-fns'

// POST - Calculate price for a booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { propertyId, checkIn, checkOut } = body

    // Validation
    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: 'Property ID, check-in, and check-out dates are required' },
        { status: 400 }
      )
    }

    const checkInDate = parseISO(checkIn)
    const checkOutDate = parseISO(checkOut)

    // Validate date range
    if (checkOutDate <= checkInDate) {
      return NextResponse.json(
        { error: 'Η ημερομηνία αναχώρησης πρέπει να είναι μετά την άφιξη' },
        { status: 400 }
      )
    }

    // Generate array of all dates in the stay (excluding checkout date, as it's not a booked night)
    const dates = eachDayOfInterval({
      start: checkInDate,
      end: new Date(checkOutDate.getTime() - 24 * 60 * 60 * 1000) // Exclude checkout day
    })

    const breakdown: Array<{ date: string; price: number }> = []
    const missingDates: string[] = []
    let totalPrice = 0

    // For each date, find matching price range
    for (const date of dates) {
      // Format date as string for proper comparison (YYYY-MM-DD)
      const dateStr = format(date, 'yyyy-MM-dd')

      const priceRange = await prisma.priceRange.findFirst({
        where: {
          propertyId,
          AND: [
            { dateFrom: { lte: new Date(dateStr + 'T23:59:59.999Z') } },
            { dateTo: { gte: new Date(dateStr + 'T00:00:00.000Z') } }
          ]
        }
      })

      if (!priceRange) {
        missingDates.push(dateStr)
      } else {
        const price = parseFloat(priceRange.pricePerNight.toString())
        breakdown.push({
          date: dateStr,
          price
        })
        totalPrice += price
      }
    }

    // If any dates are missing prices, return error
    if (missingDates.length > 0) {
      return NextResponse.json({
        success: false,
        missingDates,
        message: 'Δεν υπάρχουν τιμές για όλες τις ημερομηνίες'
      })
    }

    // Return successful calculation
    return NextResponse.json({
      success: true,
      totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimal places
      nightsCount: dates.length,
      breakdown
    })
  } catch (error) {
    console.error('Error calculating price:', error)
    return NextResponse.json(
      { error: 'Failed to calculate price' },
      { status: 500 }
    )
  }
}
