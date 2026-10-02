import { prisma } from './prisma'
import {
  DEFAULT_COMMISSION_PERCENT,
  DEFAULT_FEE_SETTINGS,
  computeGuestPaid,
  computeIncome,
  isBookingChannel,
  type FeeSettings,
  type NightPrice,
} from './pricing'

/**
 * Server-side derivation of the money stored on a reservation.
 *
 * The client sends the per-night prices it actually showed the user (which may
 * include hand-typed nights) and, optionally, a hand-entered net. Everything
 * else — income, guest paid, the commission snapshot — is derived here, so the
 * figures that matter cannot be set by a malformed request and are computed the
 * same way on create and on update.
 */

export type ResolvedPricing = {
  nightlyPrices: NightPrice[] | null
  income: number | null
  guestPaid: number | null
  commissionPercent: number | null
  /** Kept equal to income, so the headline amount never disagrees with it. */
  totalPrice: number | null
}

export async function settingsForProperty(propertyId: string): Promise<{
  commissionPercent: number
  feeSettings: FeeSettings
}> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { businessId: true },
  })
  const row = property
    ? await prisma.pricingSettings.findUnique({ where: { businessId: property.businessId } })
    : null

  if (!row) {
    return { commissionPercent: DEFAULT_COMMISSION_PERCENT, feeSettings: DEFAULT_FEE_SETTINGS }
  }
  return {
    commissionPercent: Number(row.commissionPercent),
    feeSettings: {
      climateFeeHigh: Number(row.climateFeeHigh),
      climateFeeLow: Number(row.climateFeeLow),
      highSeasonStartMonth: row.highSeasonStartMonth,
      highSeasonEndMonth: row.highSeasonEndMonth,
    },
  }
}

/** Accept only well-formed nights, so a bad payload cannot poison the snapshot. */
export function parseNightlyPrices(raw: unknown): NightPrice[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: NightPrice[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const { date, price, manual } = item as Record<string, unknown>
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    const n = typeof price === 'number' ? price : Number(price)
    if (!Number.isFinite(n) || n < 0) return null
    out.push(manual ? { date, price: n, manual: true } : { date, price: n })
  }
  return out
}

function parseOverride(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  // A deliberate 0 is honoured; only absence means "not set".
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Derive what gets stored. When no snapshot is supplied — a legacy client, or a
 * reservation being edited without touching its dates — everything comes back
 * null and the caller leaves the existing columns alone, so nothing is
 * reinterpreted or overwritten.
 */
export async function resolvePricing(params: {
  propertyId: string
  source: string | null | undefined
  nightlyPricesRaw: unknown
  incomeOverrideRaw: unknown
}): Promise<ResolvedPricing & { incomeOverride: number | null }> {
  const { propertyId, source, nightlyPricesRaw, incomeOverrideRaw } = params

  const nights = parseNightlyPrices(nightlyPricesRaw)
  const incomeOverride = parseOverride(incomeOverrideRaw)

  if (!nights) {
    return {
      nightlyPrices: null,
      income: null,
      guestPaid: null,
      commissionPercent: null,
      totalPrice: null,
      incomeOverride,
    }
  }

  const { commissionPercent, feeSettings } = await settingsForProperty(propertyId)

  // Nights already hold the net, so commission is not applied again here.
  const income = computeIncome({ nights, source, incomeOverride })
  const guestPaid = computeGuestPaid({ nights, source, feeSettings, commissionPercent })

  return {
    nightlyPrices: nights,
    income,
    guestPaid,
    // Only meaningful for Booking, but stored either way so the rate in force is
    // always recoverable.
    commissionPercent: isBookingChannel(source) ? commissionPercent : null,
    // Point (a) of the spec: totalPrice follows income, including when income
    // comes from a hand-entered net.
    totalPrice: income,
    incomeOverride,
  }
}
