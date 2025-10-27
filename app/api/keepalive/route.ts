import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Realistic keepalive endpoint - pings 4 times per day at random hours
 *
 * HOW IT WORKS:
 * - Daily Vercel Cron triggers at 8 AM (vercel.json)
 * - First call schedules 3 more random calls between 8 AM - 11:30 PM
 * - Mimics realistic user activity pattern
 * - Keeps Supabase database and Vercel active without overusing resources
 *
 * SCHEDULE EXAMPLE:
 * - Call 1: 08:00 (triggered by Vercel Cron)
 * - Call 2: Random between 10:00-14:00
 * - Call 3: Random between 15:00-19:00
 * - Call 4: Random between 20:00-23:30
 */

// Random time windows (in hours from midnight)
const MORNING_WINDOW = { start: 10, end: 14 }    // 10 AM - 2 PM
const AFTERNOON_WINDOW = { start: 15, end: 19 }  // 3 PM - 7 PM
const EVENING_WINDOW = { start: 20, end: 23.5 }  // 8 PM - 11:30 PM

function getRandomTimeInWindow(startHour: number, endHour: number): number {
  const now = new Date()
  const startTime = new Date(now)
  startTime.setHours(startHour, 0, 0, 0)

  const endTime = new Date(now)
  const endHourInt = Math.floor(endHour)
  const endMinutes = (endHour % 1) * 60
  endTime.setHours(endHourInt, endMinutes, 0, 0)

  const randomTime = startTime.getTime() + Math.random() * (endTime.getTime() - startTime.getTime())
  return Math.max(0, randomTime - Date.now())
}

function scheduleNextCalls(baseUrl: string, cronSecret: string) {
  // Schedule 3 more calls at random times
  const delays = [
    getRandomTimeInWindow(MORNING_WINDOW.start, MORNING_WINDOW.end),
    getRandomTimeInWindow(AFTERNOON_WINDOW.start, AFTERNOON_WINDOW.end),
    getRandomTimeInWindow(EVENING_WINDOW.start, EVENING_WINDOW.end)
  ]

  delays.forEach((delay, index) => {
    setTimeout(() => {
      fetch(`${baseUrl}/api/keepalive?secret=${cronSecret}`)
        .catch(err => console.error(`Scheduled keepalive ${index + 2} failed:`, err))
    }, delay)
  })
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify secret for security
    const secret = request.nextUrl.searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'CRON_SECRET not configured'
        },
        { status: 500 }
      )
    }

    if (secret !== cronSecret) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Unauthorized'
        },
        { status: 401 }
      )
    }

    // Ping database to keep it active
    await prisma.$queryRaw`SELECT 1`

    const duration = Date.now() - startTime

    // Check if this is the first call of the day (from cron)
    // Schedule 3 more calls only if it's the morning trigger
    const isFirstCall = request.nextUrl.searchParams.get('first') === 'true'
    if (isFirstCall) {
      const baseUrl = request.nextUrl.origin
      scheduleNextCalls(baseUrl, cronSecret)
    }

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Keepalive successful',
      callType: isFirstCall ? 'scheduled (3 more calls queued)' : 'automatic',
      services: {
        database: 'active',
        vercel: 'active'
      },
      queryDuration: `${duration}ms`
    })
  } catch (error) {
    console.error('Keepalive failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        services: {
          database: 'error',
          vercel: 'active'
        }
      },
      { status: 500 }
    )
  }
}
