/**
 * Text building blocks for the quick replies on the Templates page.
 *
 * Everything here is pure: the composer feeds in dates, the hotel's price
 * ranges and any prices typed by hand, and gets back plain text that reads
 * well in any chat app (no emojis, no *bold* markers, UPPERCASE headings).
 */

export type Lang = 'en' | 'el'
export type Unit = 'apartment' | 'villa'

export interface Night {
  date: string // yyyy-MM-dd, the night being slept
  price: number | null // null = no Direct price in the list and none typed yet
}

export interface NightGroup {
  from: string // first night
  to: string // check-out day after the last night
  nights: number
  price: number
  subtotal: number
}

interface RangeLike {
  dateFrom: string | Date
  dateTo: string | Date
  pricePerNight: string | number
}

const MONTHS: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  // Genitive, as Greek writes a day of the month: "10 Ιουλίου".
  el: ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'],
}

const WORDS = {
  en: {
    night: 'night', nights: 'nights', stayNight: 'night', stayNights: 'nights',
    total: 'TOTAL', advance: 'ADVANCE PAYMENT',
    bank: 'Bank', accountName: 'Account name', iban: 'IBAN', swift: 'SWIFT',
    fullName: 'Full name', country: 'Country', city: 'City', phone: 'Phone',
    option: 'OPTION',
  },
  el: {
    night: 'νύχτα', nights: 'νύχτες', stayNight: 'διανυκτέρευση', stayNights: 'διανυκτερεύσεις',
    total: 'ΣΥΝΟΛΟ', advance: 'ΠΡΟΚΑΤΑΒΟΛΗ',
    bank: 'Τράπεζα', accountName: 'Δικαιούχος', iban: 'IBAN', swift: 'SWIFT',
    fullName: 'Ονοματεπώνυμο', country: 'Χώρα', city: 'Πόλη', phone: 'Τηλέφωνο',
    option: 'ΕΠΙΛΟΓΗ',
  },
} as const

/** Singular, plural and "per one" for the unit a hotel rents out. */
export const UNIT_WORDS: Record<Unit, Record<Lang, { one: string; many: string; per: string }>> = {
  apartment: {
    en: { one: 'apartment', many: 'apartments', per: 'Per apartment' },
    el: { one: 'διαμέρισμα', many: 'διαμερίσματα', per: 'Ανά διαμέρισμα' },
  },
  villa: {
    en: { one: 'villa', many: 'villas', per: 'Per villa' },
    el: { one: 'βίλα', many: 'βίλες', per: 'Ανά βίλα' },
  },
}

// Dates travel as yyyy-MM-dd strings and are handled at UTC midnight, the same
// way the price ranges are stored, so no timezone can shift a night.
function toUtc(day: string): Date {
  return new Date(day + 'T00:00:00.000Z')
}

function addDays(day: string, n: number): string {
  const d = toUtc(day)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** The nights of a stay: check-in up to, not including, check-out. */
export function nightsBetween(checkIn: string, checkOut: string): string[] {
  const out: string[] = []
  for (let day = checkIn; day < checkOut; day = addDays(day, 1)) out.push(day)
  return out
}

/** Direct ("Απευθείας") price per night, matched the same way calculate-price does. */
export function directPricesFor(dates: string[], ranges: RangeLike[]): Night[] {
  return dates.map((date) => {
    const cell = toUtc(date)
    const range = ranges.find((r) => cell >= new Date(r.dateFrom) && cell <= new Date(r.dateTo))
    return { date, price: range ? Number(range.pricePerNight) : null }
  })
}

/** Consecutive nights at the same price become one line. Expects every price filled. */
export function groupNights(nights: Night[]): NightGroup[] {
  const groups: NightGroup[] = []
  for (const night of nights) {
    const price = night.price ?? 0
    const last = groups[groups.length - 1]
    if (last && last.price === price && last.to === night.date) {
      last.nights += 1
      last.to = addDays(night.date, 1)
      last.subtotal = round(last.nights * price)
    } else {
      groups.push({ from: night.date, to: addDays(night.date, 1), nights: 1, price, subtotal: price })
    }
  }
  return groups
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** 1750 -> "1.750€", 82.5 -> "82,50€". */
export function formatEuro(n: number): string {
  const whole = Number.isInteger(n)
  const text = n.toLocaleString('de-DE', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${text}€`
}

function dayMonth(day: string, lang: Lang): { d: number; m: string; y: number } {
  const date = toUtc(day)
  return { d: date.getUTCDate(), m: MONTHS[lang][date.getUTCMonth()], y: date.getUTCFullYear() }
}

/** "10 – 15 July", or "31 July – 1 August" when the line crosses a month. */
function shortSpan(from: string, to: string, lang: Lang): string {
  const a = dayMonth(from, lang)
  const b = dayMonth(to, lang)
  return a.m === b.m ? `${a.d} – ${b.d} ${b.m}` : `${a.d} ${a.m} – ${b.d} ${b.m}`
}

export function fullDate(day: string, lang: Lang): string {
  const { d, m, y } = dayMonth(day, lang)
  return `${d} ${m} ${y}`
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "10 July 2026 – 20 July 2026" and the number of nights on the next line. */
export function renderStayDates(checkIn: string, checkOut: string, lang: Lang): string {
  const w = WORDS[lang]
  const n = nightsBetween(checkIn, checkOut).length
  return `${fullDate(checkIn, lang)} – ${fullDate(checkOut, lang)}\n${count(n, w.stayNight, w.stayNights)}`
}

export function totalFor(groups: NightGroup[], apartments: number): number {
  return round(groups.reduce((sum, g) => sum + g.subtotal, 0) * apartments)
}

/** Price lines, the per-unit step when there is more than one unit, and the total. */
export function renderPriceBlock(
  groups: NightGroup[],
  apartments: number,
  lang: Lang,
  unit: Unit = 'apartment'
): string {
  const w = WORDS[lang]
  const u = UNIT_WORDS[unit][lang]
  const lines = groups.map(
    (g) =>
      `${shortSpan(g.from, g.to, lang)}:  ${count(g.nights, w.night, w.nights)} × ${formatEuro(g.price)} = ${formatEuro(g.subtotal)}`
  )
  const perApartment = totalFor(groups, 1)
  lines.push('')
  if (apartments > 1) {
    lines.push(`${u.per}: ${formatEuro(perApartment)}`)
    lines.push(`${count(apartments, u.one, u.many)} × ${formatEuro(perApartment)}`)
    lines.push('')
  }
  lines.push(`${w.total}: ${formatEuro(totalFor(groups, apartments))}`)
  return lines.join('\n')
}

/** One alternative period: heading, dates, then its own price block. */
export function renderOption(
  index: number,
  checkIn: string,
  checkOut: string,
  groups: NightGroup[],
  apartments: number,
  lang: Lang,
  unit: Unit = 'apartment'
): string {
  return [
    `${WORDS[lang].option} ${index}`,
    renderStayDates(checkIn, checkOut, lang),
    '',
    renderPriceBlock(groups, apartments, lang, unit),
  ].join('\n')
}

interface PaymentMethodLike {
  type: string
  details: {
    bankName?: string
    accountName?: string
    accountNumber?: string
    swift?: string
    fullName?: string
    country?: string
    city?: string
    phone?: string
  }
}

/** "500" -> "500€"; anything already carrying a currency is kept as typed. */
function advanceText(raw: string): string {
  const trimmed = raw.trim()
  const n = Number(trimmed.replace(',', '.'))
  if (trimmed !== '' && Number.isFinite(n)) return formatEuro(n)
  return trimmed
}

/** Advance amount and the payment method's details, one copyable value per line. */
export function renderPaymentInfo(method: PaymentMethodLike, advance: string, lang: Lang): string {
  const w = WORDS[lang]
  const d = method.details
  const pairs: [string, string | undefined][] =
    method.type === 'western_union'
      ? [[w.fullName, d.fullName], [w.country, d.country], [w.city, d.city], [w.phone, d.phone]]
      : [[w.bank, d.bankName], [w.accountName, d.accountName], [w.iban, d.accountNumber], [w.swift, d.swift]]
  const lines = [`${w.advance}: ${advanceText(advance)}`, '']
  for (const [label, value] of pairs) if (value) lines.push(`${label}: ${value}`)
  return lines.join('\n')
}

/** Fill {{KEY}} placeholders; an empty one leaves no run of blank lines behind. */
export function fillTemplate(body: string, values: Record<string, string>): string {
  let out = body
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{{${key}}}`).join(value)
  }
  return out.replace(/\n{3,}/g, '\n\n').trim()
}
