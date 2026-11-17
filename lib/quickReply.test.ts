import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  nightsBetween,
  directPricesFor,
  groupNights,
  renderPriceBlock,
  renderStayDates,
  renderPaymentInfo,
  fillTemplate,
  formatEuro,
} from './quickReply'

const ranges = [
  // Stored as the API returns them: dateTo is the end of the last night.
  { dateFrom: '2026-07-01T00:00:00.000Z', dateTo: '2026-07-14T23:59:59.999Z', pricePerNight: '80' },
  { dateFrom: '2026-07-15T00:00:00.000Z', dateTo: '2026-07-31T23:59:59.999Z', pricePerNight: '95.00' },
]

test('nightsBetween excludes the check-out day', () => {
  assert.deepEqual(nightsBetween('2026-07-10', '2026-07-13'), ['2026-07-10', '2026-07-11', '2026-07-12'])
  assert.deepEqual(nightsBetween('2026-07-10', '2026-07-10'), [])
})

test('directPricesFor reads the Direct price and leaves gaps as null', () => {
  const nights = directPricesFor(['2026-06-30', '2026-07-14', '2026-07-15'], ranges)
  assert.deepEqual(nights, [
    { date: '2026-06-30', price: null },
    { date: '2026-07-14', price: 80 },
    { date: '2026-07-15', price: 95 },
  ])
})

test('groupNights merges consecutive nights with the same price', () => {
  const nights = directPricesFor(nightsBetween('2026-07-10', '2026-07-20'), ranges)
  const groups = groupNights(nights)
  assert.equal(groups.length, 2)
  assert.deepEqual(
    groups.map((g) => [g.from, g.to, g.nights, g.price, g.subtotal]),
    [
      ['2026-07-10', '2026-07-15', 5, 80, 400],
      ['2026-07-15', '2026-07-20', 5, 95, 475],
    ]
  )
})

test('groupNights splits when a single night is changed by hand', () => {
  const nights = directPricesFor(nightsBetween('2026-07-10', '2026-07-13'), ranges)
  nights[1] = { ...nights[1], price: 100 }
  assert.deepEqual(groupNights(nights).map((g) => g.price), [80, 100, 80])
})

test('formatEuro uses Greek thousands and drops .00', () => {
  assert.equal(formatEuro(1750), '1.750€')
  assert.equal(formatEuro(80), '80€')
  assert.equal(formatEuro(82.5), '82,50€')
})

test('price block for one apartment shows lines and total', () => {
  const groups = groupNights(directPricesFor(nightsBetween('2026-07-10', '2026-07-20'), ranges))
  assert.equal(
    renderPriceBlock(groups, 1, 'en'),
    ['10 – 15 July:  5 nights × 80€ = 400€', '15 – 20 July:  5 nights × 95€ = 475€', '', 'TOTAL: 875€'].join('\n')
  )
})

test('price block multiplies by apartments and shows the per-apartment line', () => {
  const groups = groupNights(directPricesFor(nightsBetween('2026-07-10', '2026-07-20'), ranges))
  assert.equal(
    renderPriceBlock(groups, 2, 'el'),
    [
      '10 – 15 Ιουλίου:  5 νύχτες × 80€ = 400€',
      '15 – 20 Ιουλίου:  5 νύχτες × 95€ = 475€',
      '',
      'Ανά διαμέρισμα: 875€',
      '2 διαμερίσματα × 875€',
      '',
      'ΣΥΝΟΛΟ: 1.750€',
    ].join('\n')
  )
})

test('price block names villas for a villa hotel', () => {
  const groups = groupNights(directPricesFor(nightsBetween('2026-07-10', '2026-07-12'), ranges))
  const block = renderPriceBlock(groups, 3, 'el', 'villa')
  assert.ok(block.includes('Ανά βίλα: 160€'))
  assert.ok(block.includes('3 βίλες × 160€'))
  assert.ok(renderPriceBlock(groups, 2, 'en', 'villa').includes('2 villas × 160€'))
})

test('a line crossing months names both months, a single night is singular', () => {
  const nights = [
    { date: '2026-07-31', price: 95 },
  ]
  const groups = groupNights(nights)
  assert.equal(renderPriceBlock(groups, 1, 'en').split('\n')[0], '31 July – 1 August:  1 night × 95€ = 95€')
})

test('renderStayDates shows the range and night count', () => {
  assert.equal(renderStayDates('2026-07-10', '2026-07-20', 'en'), '10 July 2026 – 20 July 2026\n10 nights')
  assert.equal(renderStayDates('2026-07-10', '2026-07-11', 'el'), '10 Ιουλίου 2026 – 11 Ιουλίου 2026\n1 διανυκτέρευση')
})

test('renderPaymentInfo writes bank details as copyable lines', () => {
  const text = renderPaymentInfo(
    { type: 'bank', details: { bankName: 'Piraeus', accountName: 'E. K.', accountNumber: 'GR12 3456' } },
    '500',
    'en'
  )
  assert.equal(text, ['ADVANCE PAYMENT: 500€', '', 'Bank: Piraeus', 'Account name: E. K.', 'IBAN: GR12 3456'].join('\n'))
})

test('fillTemplate replaces every placeholder and trims blank runs', () => {
  const out = fillTemplate('A\n\n{{PRICE}}\n\n\n\nB {{PRICE}}', { PRICE: 'x' })
  assert.equal(out, 'A\n\nx\n\nB x')
})
