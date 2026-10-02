import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_COMMISSION_PERCENT, DEFAULT_FEE_SETTINGS } from '@/lib/pricing'

/**
 * Per-business pricing constants: Booking commission and the climate fee.
 *
 * GET never creates a row — a business without one reads as the defaults, so
 * the app behaves identically before and after anyone opens the settings. PUT
 * upserts.
 */

function shape(row: {
  commissionPercent: unknown
  climateFeeHigh: unknown
  climateFeeLow: unknown
  highSeasonStartMonth: number
  highSeasonEndMonth: number
} | null) {
  if (!row) {
    return {
      commissionPercent: DEFAULT_COMMISSION_PERCENT,
      ...DEFAULT_FEE_SETTINGS,
      isDefault: true,
    }
  }
  return {
    commissionPercent: Number(row.commissionPercent),
    climateFeeHigh: Number(row.climateFeeHigh),
    climateFeeLow: Number(row.climateFeeLow),
    highSeasonStartMonth: row.highSeasonStartMonth,
    highSeasonEndMonth: row.highSeasonEndMonth,
    isDefault: false,
  }
}

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get('businessId')
    if (!businessId) {
      return NextResponse.json({ error: 'businessId απαιτείται' }, { status: 400 })
    }
    const row = await prisma.pricingSettings.findUnique({ where: { businessId } })
    return NextResponse.json(shape(row))
  } catch (error) {
    console.error('Error fetching pricing settings:', error)
    return NextResponse.json({ error: 'Αποτυχία φόρτωσης ρυθμίσεων' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, commissionPercent, climateFeeHigh, climateFeeLow, highSeasonStartMonth, highSeasonEndMonth } = body

    if (!businessId) {
      return NextResponse.json({ error: 'businessId απαιτείται' }, { status: 400 })
    }

    const commission = Number(commissionPercent)
    const high = Number(climateFeeHigh)
    const low = Number(climateFeeLow)
    const startMonth = Number(highSeasonStartMonth)
    const endMonth = Number(highSeasonEndMonth)

    if (!Number.isFinite(commission) || commission < 0 || commission >= 100) {
      return NextResponse.json({ error: 'Η προμήθεια πρέπει να είναι 0–99%' }, { status: 400 })
    }
    if (![high, low].every((n) => Number.isFinite(n) && n >= 0)) {
      return NextResponse.json({ error: 'Το τέλος δεν μπορεί να είναι αρνητικό' }, { status: 400 })
    }
    if (![startMonth, endMonth].every((n) => Number.isInteger(n) && n >= 1 && n <= 12)) {
      return NextResponse.json({ error: 'Οι μήνες πρέπει να είναι 1–12' }, { status: 400 })
    }

    const data = {
      commissionPercent: commission,
      climateFeeHigh: high,
      climateFeeLow: low,
      highSeasonStartMonth: startMonth,
      highSeasonEndMonth: endMonth,
    }

    const row = await prisma.pricingSettings.upsert({
      where: { businessId },
      update: data,
      create: { businessId, ...data },
    })

    // Changing these never rewrites an existing reservation: each one stores the
    // commission it was created with, and its nightly prices are frozen.
    return NextResponse.json(shape(row))
  } catch (error) {
    console.error('Error saving pricing settings:', error)
    return NextResponse.json({ error: 'Αποτυχία αποθήκευσης ρυθμίσεων' }, { status: 500 })
  }
}
