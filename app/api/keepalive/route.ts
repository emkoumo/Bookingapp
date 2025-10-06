import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Keepalive endpoint to prevent Neon database from auto-suspending
 * 
 * USAGE:
 * - Call this endpoint every 4 minutes to keep database warm
 * - Can be triggered by Vercel Cron or external service (cron-job.org)
 * 
 * COST ANALYSIS:
 * - Vercel Cron: ~360 calls/day = ~10,800/month (1% of 1M free tier)
 * - External Cron: 0 cost to Vercel
 * 
 * RECOMMENDATION:
 * - Only use if you need sub-second response times always
 * - For personal/internal tools with <5 users, NOT RECOMMENDED
 * - 500ms cold start is acceptable for most use cases
 */
export async function GET() {
  try {
    // Simple query to keep connection alive
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Database connection active'
    })
  } catch (error) {
    console.error('Keepalive failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
