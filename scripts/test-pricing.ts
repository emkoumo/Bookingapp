import {
  climateFeeForNight, computeIncome, computeGuestPaid, computeClimateFee,
  nightsBetween, buildNightlyPrices, nightsTotal,
  CHANNEL_BOOKING, CHANNEL_DIRECT, DEFAULT_FEE_SETTINGS,
} from '../lib/pricing'

let pass = 0, fail = 0
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`)
}

// ---- climate fee per night, incl. the Oct/Nov boundary ----
eq('fee 15 Aug = 8', climateFeeForNight('2027-08-15'), 8)
eq('fee 31 Oct = 8', climateFeeForNight('2027-10-31'), 8)
eq('fee 1 Nov  = 2', climateFeeForNight('2027-11-01'), 2)
eq('fee 31 Mar = 2', climateFeeForNight('2027-03-31'), 2)
eq('fee 1 Apr  = 8', climateFeeForNight('2027-04-01'), 8)
eq('fee 1 Jan  = 2', climateFeeForNight('2027-01-01'), 2)

// ---- nights ----
eq('13->16 Aug = 3 nights', nightsBetween('2026-08-13', '2026-08-16'),
   ['2026-08-13', '2026-08-14', '2026-08-15'])
eq('crosses year end', nightsBetween('2026-12-30', '2027-01-02'),
   ['2026-12-30', '2026-12-31', '2027-01-01'])

// ---- the spreadsheet's peak row: Booking 392, fee 8 ----
const peak = [392, 392, 392, 392, 392].map((p, i) => ({ date: `2027-07-1${2 + i}`, price: p }))
eq('peak gross', nightsTotal(peak), 1960)
eq('peak income (net 333.2/night x5)',
   computeIncome({ nights: peak, source: CHANNEL_BOOKING, commissionPercent: 15 }), 1666)
eq('peak guest paid (400/night x5)',
   computeGuestPaid({ nights: peak, source: CHANNEL_BOOKING }), 2000)
eq('peak fee total', computeClimateFee({ nights: peak, source: CHANNEL_BOOKING }), 40)

// ---- the same stay sold Direct at the rounded 350 ----
const direct = [350, 350, 350, 350, 350].map((p, i) => ({ date: `2027-07-1${2 + i}`, price: p }))
eq('direct income = price', computeIncome({ nights: direct, source: CHANNEL_DIRECT, commissionPercent: 15 }), 1750)
eq('direct guest paid = price (fee already inside)',
   computeGuestPaid({ nights: direct, source: CHANNEL_DIRECT }), 1750)
eq('direct fee not counted', computeClimateFee({ nights: direct, source: CHANNEL_DIRECT }), 0)

// ---- hand-entered net wins ----
eq('override beats commission',
   computeIncome({ nights: peak, source: CHANNEL_BOOKING, commissionPercent: 15, incomeOverride: 1700 }), 1700)
eq('override of 0 is honoured, not treated as unset',
   computeIncome({ nights: peak, source: CHANNEL_BOOKING, commissionPercent: 15, incomeOverride: 0 }), 0)

// ---- fee across the Oct/Nov boundary on one stay ----
const crossing = [
  { date: '2027-10-30', price: 100 },
  { date: '2027-10-31', price: 100 },
  { date: '2027-11-01', price: 100 },
  { date: '2027-11-02', price: 100 },
]
eq('boundary fee = 8+8+2+2', computeClimateFee({ nights: crossing, source: CHANNEL_BOOKING }), 20)
eq('boundary guest paid = 400 + 20', computeGuestPaid({ nights: crossing, source: CHANNEL_BOOKING }), 420)

// ---- snapshot: existing nights keep their price when the list changes ----
const lookupNew: (d: string) => number | null = () => 999
const prev = [
  { date: '2026-08-13', price: 360 },
  { date: '2026-08-14', price: 380 },
]
eq('price-list change does not move stored nights',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-15', lookup: lookupNew, previous: prev }).nights,
   prev)

// ---- date edit: surviving nights keep price, new night takes current list ----
eq('date extension prices only the new night',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-16', lookup: lookupNew, previous: prev }).nights,
   [...prev, { date: '2026-08-15', price: 999 }])

// ---- date edit shrinking drops the removed night ----
eq('shrinking drops the removed night',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-14', lookup: lookupNew, previous: prev }).nights,
   [prev[0]])

// ---- channel change re-prices everything from the current list ----
eq('channel change reprices all',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-15', lookup: lookupNew, previous: prev, repriceAll: true }).nights,
   [{ date: '2026-08-13', price: 999 }, { date: '2026-08-14', price: 999 }])

// ---- a manual night survives even a channel change ----
const withManual = [{ date: '2026-08-13', price: 300, manual: true }, { date: '2026-08-14', price: 380 }]
eq('manual night survives reprice',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-15', lookup: lookupNew, previous: withManual, repriceAll: true }).nights,
   [{ date: '2026-08-13', price: 300, manual: true }, { date: '2026-08-14', price: 999 }])

// ---- missing prices are reported, never defaulted ----
const r = buildNightlyPrices({ checkIn: '2027-07-12', checkOut: '2027-07-15', lookup: () => null })
eq('missing nights listed', r.missing, ['2027-07-12', '2027-07-13', '2027-07-14'])
eq('missing nights not priced', r.nights, [])

console.log(`\n${fail === 0 ? `ALL ${pass} ASSERTIONS PASS` : `${fail} FAILED, ${pass} passed`}`)
process.exit(fail === 0 ? 0 : 1)
