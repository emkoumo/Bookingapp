/**
 * Income and guest-paid arithmetic.
 *
 * Two channels, and the difference matters:
 *
 *  - Direct (phone, message, walk-in): the nightly price IS the income. It
 *    already includes the climate fee, so nothing is added and nothing is
 *    deducted.
 *  - Booking.com: the nightly price is the Extranet price BEFORE the fee.
 *    Income is that minus commission; the guest additionally pays the fee.
 *
 * The climate fee is never income — it is collected for the state. It appears
 * only in `guestPaid`, and never in any total.
 *
 * Every function here is pure: no database, no clock, no I/O. The snapshot that
 * reaches the database is built by `buildNightlyPrices` and then frozen onto
 * the reservation, so a later price-list or commission change cannot move it.
 */

export const CHANNEL_BOOKING = 'booking_com'
export const CHANNEL_DIRECT = 'manual'

/** One night of a reservation, as stored in Booking.nightlyPrices. */
export type NightPrice = {
  /** yyyy-MM-dd */
  date: string
  /**
   * The channel price for this night. For Direct that is the quoted price; for
   * Booking it is the Extranet price before commission and before the fee.
   */
  price: number
  /** True when typed by hand rather than taken from the price list. */
  manual?: boolean
}

export type FeeSettings = {
  climateFeeHigh: number
  climateFeeLow: number
  highSeasonStartMonth: number
  highSeasonEndMonth: number
}

export const DEFAULT_FEE_SETTINGS: FeeSettings = {
  climateFeeHigh: 8,
  climateFeeLow: 2,
  highSeasonStartMonth: 4,
  highSeasonEndMonth: 10,
}

export const DEFAULT_COMMISSION_PERCENT = 15

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Climate fee for a single night, decided by its own month — so a stay that
 * crosses 31 Oct / 1 Nov is charged correctly rather than taking one rate for
 * the whole stay.
 */
export function climateFeeForNight(dateIso: string, settings: FeeSettings = DEFAULT_FEE_SETTINGS): number {
  const month = Number(dateIso.slice(5, 7))
  const { highSeasonStartMonth: from, highSeasonEndMonth: to } = settings
  // Written to tolerate a wrapped season (e.g. Nov–Mar) as well as Apr–Oct.
  const high = from <= to ? month >= from && month <= to : month >= from || month <= to
  return high ? settings.climateFeeHigh : settings.climateFeeLow
}

export function isBookingChannel(source: string | null | undefined): boolean {
  return source === CHANNEL_BOOKING
}

/** Sum of the channel prices — the guest-facing total for a Direct stay. */
export function nightsTotal(nights: NightPrice[]): number {
  return round2(nights.reduce((s, n) => s + n.price, 0))
}

/**
 * What you actually keep.
 *
 * Booking: channel price less commission. Direct: the price itself.
 * A hand-entered net always wins — that is the point of it, for when the real
 * payout is known.
 */
export function computeIncome(params: {
  nights: NightPrice[]
  source: string | null | undefined
  commissionPercent: number
  incomeOverride?: number | null
}): number {
  const { nights, source, commissionPercent, incomeOverride } = params
  if (incomeOverride !== undefined && incomeOverride !== null) return round2(incomeOverride)

  const gross = nightsTotal(nights)
  if (!isBookingChannel(source)) return gross

  return round2(gross * (1 - commissionPercent / 100))
}

/**
 * What the guest paid. Informational only — never part of income or any total.
 *
 * Booking: Extranet price plus that night's fee. Direct: the price as-is,
 * because the fee is already inside it and adding it would double-count.
 */
export function computeGuestPaid(params: {
  nights: NightPrice[]
  source: string | null | undefined
  feeSettings?: FeeSettings
}): number {
  const { nights, source, feeSettings = DEFAULT_FEE_SETTINGS } = params
  if (!isBookingChannel(source)) return nightsTotal(nights)

  return round2(
    nights.reduce((s, n) => s + n.price + climateFeeForNight(n.date, feeSettings), 0)
  )
}

/** Total climate fee, for information only. Zero on a Direct stay. */
export function computeClimateFee(params: {
  nights: NightPrice[]
  source: string | null | undefined
  feeSettings?: FeeSettings
}): number {
  const { nights, source, feeSettings = DEFAULT_FEE_SETTINGS } = params
  if (!isBookingChannel(source)) return 0
  return round2(nights.reduce((s, n) => s + climateFeeForNight(n.date, feeSettings), 0))
}

/** The nights of a stay, as yyyy-MM-dd. checkOut is exclusive. */
export function nightsBetween(checkIn: string, checkOut: string): string[] {
  const toDay = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
    return Math.round(Date.UTC(y, m - 1, d) / 86400000)
  }
  const out: string[] = []
  for (let d = toDay(checkIn); d < toDay(checkOut); d++) {
    out.push(new Date(d * 86400000).toISOString().slice(0, 10))
  }
  return out
}

export type RangeLookup = (dateIso: string) => number | null

/**
 * Build the snapshot for a stay.
 *
 * `previous` is what the reservation already held. Any night still in the stay
 * keeps its stored price — that is what makes a price-list change invisible to
 * an existing reservation, and what lets a date edit re-price only the nights
 * that actually moved. Nights with no price in the list are returned in
 * `missing` rather than silently defaulted.
 */
export function buildNightlyPrices(params: {
  checkIn: string
  checkOut: string
  lookup: RangeLookup
  previous?: NightPrice[] | null
  /** Set when the channel changed: every night re-prices from the current list. */
  repriceAll?: boolean
}): { nights: NightPrice[]; missing: string[] } {
  const { checkIn, checkOut, lookup, previous, repriceAll } = params
  const prev = new Map((previous ?? []).map((n) => [n.date, n]))

  const nights: NightPrice[] = []
  const missing: string[] = []

  for (const date of nightsBetween(checkIn, checkOut)) {
    const kept = prev.get(date)

    // A hand-entered price survives everything, including a channel change.
    if (kept?.manual) {
      nights.push(kept)
      continue
    }

    if (kept && !repriceAll) {
      nights.push(kept)
      continue
    }

    const price = lookup(date)
    if (price === null) {
      missing.push(date)
      continue
    }
    nights.push({ date, price })
  }

  return { nights, missing }
}
