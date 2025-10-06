import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const businesses = await prisma.business.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(businesses)
  } catch (error) {
    console.error('Error fetching businesses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch businesses' },
      { status: 500 }
    )
  }
}
