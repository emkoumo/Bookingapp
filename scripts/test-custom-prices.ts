/**
 * Custom-price arithmetic: one price for all nights, mixed list/manual, and a
 * different price per night — on both channels. Pure, no database.
 */
import { computeIncome, computeGuestPaid, computeClimateFee, nightsTotal, bookingPriceToNet, type NightPrice } from '../lib/pricing'

let pass = 0, fail = 0
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}
const C = 15

// ---------- 1. ONE PRICE FOR ALL NIGHTS (the bulk field) ----------
// 4 Aug nights at 400, all typed by hand
const bulk: NightPrice[] = ['2027-08-10','2027-08-11','2027-08-12','2027-08-13']
  .map(date => ({ date, price: 400, manual: true }))

eq('bulk: gross 4x400', nightsTotal(bulk), 1600)
eq('bulk DIRECT income = gross', computeIncome({ nights: bulk, source: 'manual' }), 1600)
eq('bulk DIRECT guest paid = gross (fee inside)', computeGuestPaid({ nights: bulk, source: 'manual' }), 1600)
eq('bulk BOOKING income = typed net, NOT x0.85', computeIncome({ nights: bulk, source: 'booking_com' }), 1600)
eq('bulk BOOKING guest paid reconstructs the Extranet price + fee',
   computeGuestPaid({ nights: bulk, source: 'booking_com', commissionPercent: C }), 1914.36)
eq('bulk BOOKING fee', computeClimateFee({ nights: bulk, source: 'booking_com' }), 32)

// ---------- 2. MIXED: some nights from the list, some typed ----------
const mixed: NightPrice[] = [
  { date: '2027-08-10', price: 360 },                 // from list
  { date: '2027-08-11', price: 400, manual: true },   // typed
  { date: '2027-08-12', price: 360 },                 // from list
  { date: '2027-08-13', price: 450, manual: true },   // typed
]
eq('mixed: gross 360+400+360+450', nightsTotal(mixed), 1570)
eq('mixed DIRECT income', computeIncome({ nights: mixed, source: 'manual' }), 1570)
eq('mixed BOOKING income = plain sum of net', computeIncome({ nights: mixed, source: 'booking_com' }), 1570)

// ---------- 3. DIFFERENT PRICE PER NIGHT (the opt-in) ----------
const perNight: NightPrice[] = [
  { date: '2027-08-10', price: 300, manual: true },
  { date: '2027-08-11', price: 350, manual: true },
  { date: '2027-08-12', price: 500, manual: true },
]
eq('per-night: gross 300+350+500', nightsTotal(perNight), 1150)
eq('per-night DIRECT income', computeIncome({ nights: perNight, source: 'manual' }), 1150)
eq('per-night BOOKING income = typed net', computeIncome({ nights: perNight, source: 'booking_com' }), 1150)

// ---------- 4. CUSTOM PRICE + HAND-ENTERED NET (override wins) ----------
eq('override beats custom-price calc',
   computeIncome({ nights: bulk, source: 'booking_com', incomeOverride: 1400 }), 1400)

// ---------- 5. ROUNDING: a price that does not divide cleanly ----------
const odd: NightPrice[] = [
  { date: '2027-08-10', price: 333.33, manual: true },
  { date: '2027-08-11', price: 333.33, manual: true },
  { date: '2027-08-12', price: 333.34, manual: true },
]
eq('odd: gross exactly 1000', nightsTotal(odd), 1000)
eq('odd BOOKING income = 1000 (net as typed)', computeIncome({ nights: odd, source: 'booking_com' }), 1000)
// the list conversion is where commission belongs
eq('list Extranet 177 -> 150.45 net', bookingPriceToNet(177, C), 150.45)
eq('that net as one night -> income 150.45',
   computeIncome({ nights: [{ date: '2027-10-05', price: 150.45 }], source: 'booking_com' }), 150.45)

// ---------- 6. FEE BOUNDARY with custom prices across Oct/Nov ----------
const crossing: NightPrice[] = [
  { date: '2027-10-30', price: 200, manual: true },
  { date: '2027-10-31', price: 200, manual: true },
  { date: '2027-11-01', price: 200, manual: true },
]
eq('crossing fee 8+8+2', computeClimateFee({ nights: crossing, source: 'booking_com' }), 18)
eq('crossing DIRECT adds no fee', computeGuestPaid({ nights: crossing, source: 'manual' }), 600)

// ---------- 7. the bulk field total shown in the UI matches the snapshot ----------
const uiTotal = 400 * 4
eq('UI "Σύνολο για τις 4 νύχτες" matches snapshot gross', uiTotal, nightsTotal(bulk))

console.log(`\n${fail === 0 ? `ALL ${pass} CUSTOM-PRICE ASSERTIONS PASS` : `${fail} FAILED, ${pass} passed`}`)
process.exit(fail === 0 ? 0 : 1)
