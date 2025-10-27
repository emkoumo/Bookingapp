import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Keepalive endpoint to prevent both Supabase database and Vercel from auto-suspending
 *
 * USAGE:
 * - Triggered by Vercel Cron every 5 minutes (configured in vercel.json)
 * - Keeps database connection warm (prevents Supabase free tier pause)
 * - Keeps Vercel serverless function warm (prevents cold starts)
 *
 * COST ANALYSIS:
 * - Vercel Cron: ~288 calls/day = ~8,640/month (<1% of 1M free tier)
 * - Function invocations: Minimal impact on compute hours
 *
 * HOW IT WORKS:
 * - Vercel Cron calls this endpoint every 5 minutes
 * - This keeps the Vercel function "warm" (prevents cold starts)
 * - The database query keeps Supabase connection active (prevents auto-pause)
 *
 */
export async function GET() {
  try {
    const startTime = Date.now()

    // Simple query to keep database connection alive
    await prisma.$queryRaw`SELECT 1`

    const duration = Date.now() - startTime

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Keepalive successful',
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
