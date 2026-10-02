import { isBookingChannel } from './pricing'

/**
 * How a reservation's money is presented, in one place, so the cards, the
 * reports, the analytics and the PDF cannot drift apart.
 *
 * The headline is always INCOME — net for Booking, the Direct price otherwise.
 * `guestPaid` is informational and shown in parentheses on Booking only; it is
 * never added into a total.
 *
 * Legacy reservations (those predating the snapshot columns) have income NULL,
 * so everything falls back to totalPrice and they display exactly as they
 * always have.
 */

export type DisplayBooking = {
  source?: string | null
  notes?: string | null
  totalPrice?: number | string | null
  income?: number | string | null
  guestPaid?: number | string | null
  advancePayment?: number | string | null
  remainingBalance?: number | string | null
  incomeOverride?: number | string | null
  hasCustomPrice?: boolean | null
}

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v)

/** True when this reservation predates the income columns. */
export function isLegacyPricing(b: DisplayBooking): boolean {
  return num(b.income) === null
}

/** The headline amount: income when known, otherwise the stored total. */
export function displayIncome(b: DisplayBooking): number {
  return num(b.income) ?? num(b.totalPrice) ?? 0
}

/**
 * What the guest paid, for the parenthesised figure. Null unless this is a
 * Booking reservation that actually recorded it — legacy Booking rows show
 * nothing rather than a guess.
 */
export function displayGuestPaid(b: DisplayBooking): number | null {
  if (!isBookingChannel(b.source)) return null
  return num(b.guestPaid)
}

/**
 * Whether to present a remaining balance at all.
 *
 * Never on Booking: the advance is disabled there and Booking settles by bank
 * transfer, so showing total − advance would read as money still owed.
 */
export function showsRemainingBalance(b: DisplayBooking): boolean {
  return !isBookingChannel(b.source)
}

/** Outstanding amount, or null when the channel has no meaningful balance. */
export function displayRemaining(b: DisplayBooking): number | null {
  if (!showsRemainingBalance(b)) return null
  const total = displayIncome(b)
  const advance = num(b.advancePayment) ?? 0
  return Math.round(Math.max(0, total - advance) * 100) / 100
}

/** Advance, or null on Booking where it does not apply. */
export function displayAdvance(b: DisplayBooking): number | null {
  if (isBookingChannel(b.source)) return null
  return num(b.advancePayment)
}

/** True when the orange manual marker should show. */
export function isManuallyPriced(b: DisplayBooking): boolean {
  return Boolean(b.hasCustomPrice) || num(b.incomeOverride) !== null
}

export const formatEuro = (n: number): string =>
  '€' + n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Totals for a set of reservations.
 *
 * Revenue is the sum of income — Booking contributes its net, not its gross.
 * Guest-paid and the climate fee are deliberately absent: they are not income
 * and must never appear in a total.
 */
export function summariseBookings(list: DisplayBooking[]): {
  totalIncome: number
  totalAdvances: number
  totalRemaining: number
} {
  let totalIncome = 0
  let totalAdvances = 0
  let totalRemaining = 0

  for (const b of list) {
    totalIncome += displayIncome(b)
    totalAdvances += displayAdvance(b) ?? 0
    totalRemaining += displayRemaining(b) ?? 0
  }

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalAdvances: Math.round(totalAdvances * 100) / 100,
    totalRemaining: Math.round(totalRemaining * 100) / 100,
  }
}
