import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Keep-alive endpoint to prevent database from auto-pausing
export async function GET() {
  try {
    // Lightweight query to keep the database alive
    await prisma.business.findFirst()

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Database connection is alive',
    })
  } catch (error) {
    console.error('Keep-alive error:', error)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Failed to connect to database',
      },
      { status: 500 }
    )
  }
}
