'use client'

import { useState, useEffect } from 'react'

interface Settings {
  commissionPercent: number
  climateFeeHigh: number
  climateFeeLow: number
  highSeasonStartMonth: number
  highSeasonEndMonth: number
  isDefault: boolean
}

const MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

// Fees are typed the Greek way ("0,50"); the API takes plain numbers.
const toNumber = (text: string) => Number(text.trim().replace(',', '.'))
const toText = (n: number) => String(n).replace('.', ',')
const euro = (n: number) => `${toText(Number.isInteger(n) ? n : Number(n.toFixed(2)))}€`

/**
 * Per-hotel climate fee (τέλος ανθεκτικότητας), its high season, and the
 * Booking.com commission. A hotel without saved settings runs on the defaults
 * (8€ / 2€, April–October, 15%), which suit villas but not apartments.
 */
export default function PricingSettingsPanel({ businessId }: { businessId: string }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ commission: '', high: '', low: '', start: 4, end: 10 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/pricing-settings?businessId=${businessId}`)
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => setError('Σφάλμα φόρτωσης ρυθμίσεων'))
  }, [businessId])

  const startEdit = () => {
    if (!settings) return
    setForm({
      commission: toText(settings.commissionPercent),
      high: toText(settings.climateFeeHigh),
      low: toText(settings.climateFeeLow),
      start: settings.highSeasonStartMonth,
      end: settings.highSeasonEndMonth,
    })
    setError('')
    setNotice('')
    setEditing(true)
  }

  const save = async () => {
    const commission = toNumber(form.commission)
    const high = toNumber(form.high)
    const low = toNumber(form.low)
    if (![commission, high, low].every((n) => Number.isFinite(n) && n >= 0)) {
      setError('Συμπληρώστε έγκυρους αριθμούς (π.χ. 0,50)')
      return
    }
    try {
      setSaving(true)
      setError('')
      const res = await fetch('/api/pricing-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          commissionPercent: commission,
          climateFeeHigh: high,
          climateFeeLow: low,
          highSeasonStartMonth: form.start,
          highSeasonEndMonth: form.end,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Αποτυχία αποθήκευσης')
      setSettings(data)
      setEditing(false)
      setNotice('Αποθηκεύτηκε. Ισχύει για νέες κρατήσεις· οι υπάρχουσες δεν αλλάζουν.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return null

  // The low season is whatever the high season is not, e.g. Νοέμβριος – Μάρτιος.
  const lowStart = MONTHS[settings.highSeasonEndMonth % 12]
  const lowEnd = MONTHS[(settings.highSeasonStartMonth + 10) % 12]
  const monthSelect = (value: number, onChange: (m: number) => void, label: string) => (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
    >
      {MONTHS.map((m, i) => (
        <option key={m} value={i + 1}>
          {m}
        </option>
      ))}
    </select>
  )
  const field = 'w-full pl-3 pr-8 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-right'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-gray-900 text-sm">Τέλος ανθεκτικότητας & προμήθεια</h3>
        {!editing && (
          <button
            onClick={startEdit}
            className="px-3 py-1.5 text-sm font-semibold text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50"
          >
            Αλλαγή
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-gray-600">
            {MONTHS[settings.highSeasonStartMonth - 1]} – {MONTHS[settings.highSeasonEndMonth - 1]}
          </dt>
          <dd className="font-semibold text-gray-900 text-right">{euro(settings.climateFeeHigh)} / νύχτα</dd>
          <dt className="text-gray-600">
            {lowStart} – {lowEnd}
          </dt>
          <dd className="font-semibold text-gray-900 text-right">{euro(settings.climateFeeLow)} / νύχτα</dd>
          <dt className="text-gray-600">Προμήθεια Booking.com</dt>
          <dd className="font-semibold text-gray-900 text-right">{toText(settings.commissionPercent)}%</dd>
          {settings.isDefault && (
            <dd className="col-span-2 text-xs text-amber-700 mt-1">
              Προεπιλεγμένες τιμές — δεν έχουν οριστεί για αυτό το κατάλυμα.
            </dd>
          )}
        </dl>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Υψηλή περίοδος</label>
            <div className="grid grid-cols-2 gap-2">
              {monthSelect(form.start, (m) => setForm({ ...form, start: m }), 'Από μήνα')}
              {monthSelect(form.end, (m) => setForm({ ...form, end: m }), 'Έως μήνα')}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-gray-700">
              Τέλος υψηλής περιόδου
              <div className="relative mt-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.high}
                  onChange={(e) => setForm({ ...form, high: e.target.value })}
                  className={field}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-normal">€</span>
              </div>
            </label>
            <label className="block text-xs font-bold text-gray-700">
              Τέλος χαμηλής περιόδου
              <div className="relative mt-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.low}
                  onChange={(e) => setForm({ ...form, low: e.target.value })}
                  className={field}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-normal">€</span>
              </div>
            </label>
          </div>
          <label className="block text-xs font-bold text-gray-700">
            Προμήθεια Booking.com
            <div className="relative mt-1">
              <input
                type="text"
                inputMode="decimal"
                value={form.commission}
                onChange={(e) => setForm({ ...form, commission: e.target.value })}
                className={field}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-normal">%</span>
            </div>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm"
            >
              Ακύρωση
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:opacity-90 font-semibold text-sm disabled:opacity-50"
            >
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      )}
      {notice && !editing && <p className="text-xs text-green-700 mt-3">{notice}</p>}
      {error && !editing && <p className="text-xs text-red-600 mt-3">{error}</p>}
    </div>
  )
}
