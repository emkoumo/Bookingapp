import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Self-calling keepalive endpoint to prevent Supabase and Vercel from pausing
 *
 * HOW IT WORKS:
 * - Initial call triggers the endpoint (manual or daily cron)
 * - Endpoint pings database to keep it active
 * - After response, schedules itself to be called again in 5 minutes
 * - Uses CRON_SECRET environment variable for security
 *
 * SETUP:
 * 1. Add CRON_SECRET to Vercel environment variables
 * 2. Call endpoint once: https://your-app.vercel.app/api/keepalive?secret=YOUR_SECRET
 * 3. It will keep calling itself every 5 minutes automatically
 */

const KEEPALIVE_INTERVAL = 5 * 60 * 1000 // 5 minutes

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

    // Schedule next keepalive call
    const baseUrl = request.nextUrl.origin
    setTimeout(() => {
      fetch(`${baseUrl}/api/keepalive?secret=${cronSecret}`)
        .catch(err => console.error('Next keepalive failed:', err))
    }, KEEPALIVE_INTERVAL)

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Keepalive successful',
      nextCall: new Date(Date.now() + KEEPALIVE_INTERVAL).toISOString(),
      services: {
        database: 'active',
        vercel: 'active'
      },
      queryDuration: `${duration}ms`
    })
  } catch (error) {
    console.error('Keepalive failed:', error)

    // Try to schedule next call even on error
    const baseUrl = request.nextUrl.origin
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      setTimeout(() => {
        fetch(`${baseUrl}/api/keepalive?secret=${cronSecret}`)
          .catch(err => console.error('Next keepalive failed:', err))
      }, KEEPALIVE_INTERVAL)
    }

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
