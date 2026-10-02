/**
 * Money arithmetic. Pure functions, no database.
 *
 * The central rule: a reservation's nightly price is ALWAYS the net. Commission
 * is applied exactly once — converting the price list's Extranet figure — and
 * never again. A price typed by hand is the net as typed.
 */
import {
  climateFeeForNight, computeIncome, computeGuestPaid, computeClimateFee,
  nightsBetween, buildNightlyPrices, nightsTotal,
  bookingPriceToNet, netToBookingPrice,
  CHANNEL_BOOKING, CHANNEL_DIRECT,
} from '../lib/pricing'

let pass = 0, fail = 0
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}
const C = 15

// ---- commission is applied once, at the list conversion ----
eq('177 Extranet -> 150.45 net', bookingPriceToNet(177, C), 150.45)
eq('392 Extranet -> 333.20 net', bookingPriceToNet(392, C), 333.2)
eq('150.45 net -> 177 Extranet (reverse)', netToBookingPrice(150.45, C), 177)

// ---- climate fee per night, incl. the Oct/Nov boundary ----
eq('fee 15 Aug = 8', climateFeeForNight('2027-08-15'), 8)
eq('fee 31 Oct = 8', climateFeeForNight('2027-10-31'), 8)
eq('fee 1 Nov  = 2', climateFeeForNight('2027-11-01'), 2)
eq('fee 31 Mar = 2', climateFeeForNight('2027-03-31'), 2)
eq('fee 1 Apr  = 8', climateFeeForNight('2027-04-01'), 8)

// ---- nights ----
eq('13->16 Aug = 3 nights', nightsBetween('2026-08-13', '2026-08-16'), ['2026-08-13','2026-08-14','2026-08-15'])
eq('crosses year end', nightsBetween('2026-12-30', '2027-01-02'), ['2026-12-30','2026-12-31','2027-01-01'])

// ---- income is a plain sum of net, on BOTH channels: no second deduction ----
const peakNet = Array.from({ length: 5 }, (_, i) => ({ date: `2027-07-1${2+i}`, price: bookingPriceToNet(392, C) }))
eq('peak net per night', peakNet[0].price, 333.2)
eq('peak income = 5 x 333.20 (commission NOT re-applied)',
   computeIncome({ nights: peakNet, source: CHANNEL_BOOKING }), 1666)
eq('peak guest paid = 5 x (392 + 8)',
   computeGuestPaid({ nights: peakNet, source: CHANNEL_BOOKING, commissionPercent: C }), 2000)

// the screenshot case: 177 over two nights
const two = [{ date: '2026-10-12', price: 150.45 }, { date: '2026-10-13', price: 150.45 }]
eq('2 x 177 -> income 300.90', computeIncome({ nights: two, source: CHANNEL_BOOKING }), 300.9)
eq('2 x 177 -> guest paid 370.00', computeGuestPaid({ nights: two, source: CHANNEL_BOOKING, commissionPercent: C }), 370)

// ---- a HAND-TYPED price is the net exactly as typed ----
const typed = [
  { date: '2026-10-20', price: 500, manual: true },
  { date: '2026-10-21', price: 500, manual: true },
]
eq('typed 500 x2 -> income 1000, NOT 850', computeIncome({ nights: typed, source: CHANNEL_BOOKING }), 1000)
eq('typed on Direct -> income 1000 too', computeIncome({ nights: typed, source: CHANNEL_DIRECT }), 1000)

// ---- Direct: price is the income, fee already inside ----
const direct = Array.from({ length: 5 }, (_, i) => ({ date: `2027-07-1${2+i}`, price: 350 }))
eq('direct income = price', computeIncome({ nights: direct, source: CHANNEL_DIRECT }), 1750)
eq('direct guest paid = price', computeGuestPaid({ nights: direct, source: CHANNEL_DIRECT }), 1750)
eq('direct fee not counted', computeClimateFee({ nights: direct, source: CHANNEL_DIRECT }), 0)

// ---- hand-entered net wins ----
eq('override beats the sum', computeIncome({ nights: peakNet, source: CHANNEL_BOOKING, incomeOverride: 1700 }), 1700)
eq('override of 0 honoured', computeIncome({ nights: peakNet, source: CHANNEL_BOOKING, incomeOverride: 0 }), 0)

// ---- fee across the Oct/Nov boundary on one stay ----
const crossing = ['2027-10-30','2027-10-31','2027-11-01','2027-11-02'].map(date => ({ date, price: 85 }))
eq('boundary fee = 8+8+2+2', computeClimateFee({ nights: crossing, source: CHANNEL_BOOKING }), 20)

// ---- snapshot behaviour ----
const lookupNew = () => 999
const prev = [{ date: '2026-08-13', price: 360 }, { date: '2026-08-14', price: 380 }]
eq('price-list change does not move stored nights',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-15', lookup: lookupNew, previous: prev }).nights, prev)
eq('date extension prices only the new night',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-16', lookup: lookupNew, previous: prev }).nights,
   [...prev, { date: '2026-08-15', price: 999 }])
eq('shrinking drops the removed night',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-14', lookup: lookupNew, previous: prev }).nights, [prev[0]])
eq('channel change reprices all',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-15', lookup: lookupNew, previous: prev, repriceAll: true }).nights,
   [{ date: '2026-08-13', price: 999 }, { date: '2026-08-14', price: 999 }])
const withManual = [{ date: '2026-08-13', price: 300, manual: true }, { date: '2026-08-14', price: 380 }]
eq('manual night survives reprice',
   buildNightlyPrices({ checkIn: '2026-08-13', checkOut: '2026-08-15', lookup: lookupNew, previous: withManual, repriceAll: true }).nights,
   [{ date: '2026-08-13', price: 300, manual: true }, { date: '2026-08-14', price: 999 }])
const r = buildNightlyPrices({ checkIn: '2027-07-12', checkOut: '2027-07-15', lookup: () => null })
eq('missing nights listed', r.missing, ['2027-07-12','2027-07-13','2027-07-14'])
eq('missing nights not priced', r.nights, [])
eq('gross helper sums nights', nightsTotal(two), 300.9)

console.log(`\n${fail === 0 ? `ALL ${pass} ASSERTIONS PASS` : `${fail} FAILED, ${pass} passed`}`)
process.exit(fail === 0 ? 0 : 1)
