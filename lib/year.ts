/**
 * Season/year scope, shared by every page.
 *
 * Year is a LENS, never a data boundary: nothing is ever deleted or archived
 * when the year rolls over. A 2027 booking is simply a row with 2027 dates, so
 * switching the selector back to 2026 brings the old season straight back.
 *
 * It mirrors how the business scope already works — persisted in localStorage
 * and carried between pages in the `year` query param — so both scopes behave
 * the same way and survive a reload.
 */

export const YEAR_STORAGE_KEY = 'selectedYear'

/** Earliest season the app has data for; nothing before this is offered. */
const FIRST_SEASON = 2025

export function currentYear(): number {
  return new Date().getFullYear()
}

/**
 * Years offered in the switcher: every season from FIRST_SEASON up to next
 * year. Next year matters — bookings for the coming season get taken months
 * ahead, so it has to be selectable before 1 January.
 */
export function yearOptions(): number[] {
  const to = currentYear() + 1
  const years: number[] = []
  for (let y = to; y >= FIRST_SEASON; y--) years.push(y)
  return years
}

function isValid(year: number): boolean {
  return Number.isInteger(year) && year >= FIRST_SEASON && year <= currentYear() + 1
}

/**
 * Resolve the active year: the URL wins (so a shared link is stable), then
 * whatever was last chosen, then the current year.
 */
export function resolveYear(param: string | null): number {
  const fromUrl = param ? Number(param) : NaN
  if (isValid(fromUrl)) return fromUrl

  if (typeof window !== 'undefined') {
    const saved = Number(window.localStorage.getItem(YEAR_STORAGE_KEY))
    if (isValid(saved)) return saved
  }

  return currentYear()
}

/** Inclusive date bounds of a season, as yyyy-MM-dd. */
export function yearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

/** Month-granularity bounds, as yyyy-MM (what ScrollableCalendar expects). */
export function yearMonthBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01`, end: `${year}-12` }
}

/**
 * True when a date string (yyyy-MM-dd or full ISO) falls inside the season.
 * String comparison is deliberate: the stored values are already zero-padded
 * ISO, so this needs no Date parsing and cannot be shifted by a timezone.
 */
export function inYear(iso: string | null | undefined, year: number): boolean {
  if (!iso) return false
  return iso.slice(0, 4) === String(year)
}

/**
 * True when a stay overlaps the season at all, counting nights (checkOut is
 * exclusive). A booking running 28 Dec → 3 Jan belongs to both seasons and
 * must appear in each, so this is an overlap test rather than a check-in test.
 */
export function stayTouchesYear(checkIn: string, checkOut: string, year: number): boolean {
  const { start, end } = yearBounds(year)
  const firstNight = checkIn.slice(0, 10)
  const lastNight = checkOut.slice(0, 10)
  // lastNight is the checkout day, which is not itself charged; a stay touches
  // the season when its first night is on/before 31 Dec and checkout is after 1 Jan.
  return firstNight <= end && lastNight > start
}
