'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { el } from 'date-fns/locale'
import Header from '@/components/Header'
import DatePicker from '@/components/DatePicker'
import Toast from '@/components/Toast'

/**
 * Γρήγορη Προσφορά — availability and price for a date range, across every
 * property in the app.
 *
 * Built for answering a phone call: pick two dates, read the number out loud.
 * Deliberately not business-scoped, because the caller asks "have you got
 * anything", not "have you got a villa".
 *
 * Read-only throughout; it only calls GET /api/quote.
 */

type Segment = {
  from: string
  to: string
  nights: number
  pricePerNight: number
  subtotal: number
}

type Conflict = { type: 'booking' | 'blocked'; label: string; from: string; to: string }

type QuoteProperty = {
  id: string
  name: string
  businessId: string
  businessName: string
  available: boolean
  conflicts: Conflict[]
  total: number | null
  pricePerNight: number | null
  segments: Segment[]
  missingDates: string[]
}

type Quote = {
  checkIn: string
  checkOut: string
  lastNight: string
  nights: number
  totalProperties: number
  availableCount: number
  properties: QuoteProperty[]
}

const euro = (n: number) =>
  n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

const shortDate = (iso: string) => format(parseISO(iso), 'd MMM', { locale: el })

function QuoteContent() {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)

  useEffect(() => {
    if (!checkIn || !checkOut) {
      setQuote(null)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/quote?checkIn=${checkIn}&checkOut=${checkOut}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || 'Αποτυχία υπολογισμού')
          setQuote(null)
          return
        }
        setQuote(data)
      } catch {
        if (!cancelled) setError('Αποτυχία υπολογισμού')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [checkIn, checkOut])

  const copyLine = async (p: QuoteProperty) => {
    if (p.total === null || !quote) return
    const text =
      `${p.name}: ${quote.nights} ${quote.nights === 1 ? 'νύχτα' : 'νύχτες'} ` +
      `(${shortDate(quote.checkIn)} – ${shortDate(quote.lastNight)}), ` +
      `${euro(p.total)} συνολικά, ${euro(p.pricePerNight!)}/νύχτα`
    try {
      await navigator.clipboard.writeText(text)
      setToast({ message: 'Αντιγράφηκε', type: 'success' })
    } catch {
      setToast({ message: 'Δεν ήταν δυνατή η αντιγραφή', type: 'error' })
    }
  }

  const available = quote?.properties.filter((p) => p.available) ?? []
  const taken = quote?.properties.filter((p) => !p.available) ?? []

  // Group by business so villas and apartments read as separate blocks.
  const byBusiness = (list: QuoteProperty[]) => {
    const groups = new Map<string, QuoteProperty[]>()
    for (const p of list) {
      if (!groups.has(p.businessName)) groups.set(p.businessName, [])
      groups.get(p.businessName)!.push(p)
    }
    return [...groups.entries()]
  }

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl">
          <div className="bg-white md:m-4 md:rounded-xl md:shadow-lg">
            {/* Header */}
            <div className="py-3 border-b border-gray-200">
              <div className="flex items-center justify-between px-4">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center justify-center w-9 h-9 md:w-auto md:px-3 md:py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden md:inline ml-1 text-sm font-medium">Αρχική</span>
                </button>
                <h1 className="text-lg md:text-xl font-bold text-gray-900">Γρήγορη Προσφορά</h1>
                <div className="w-9" />
              </div>
            </div>

            {/* Dates */}
            <div className="px-4 py-4 border-b border-gray-200 bg-blue-50">
              <div className="grid grid-cols-2 gap-3 mb-2">
                <label className="block text-xs font-bold text-gray-700">Άφιξη</label>
                <label className="block text-xs font-bold text-gray-700">Αναχώρηση</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  value={checkIn}
                  onChange={setCheckIn}
                  placeholder="Ημερομηνία"
                  maxDate={checkOut || undefined}
                  highlightDate={checkOut || undefined}
                />
                <DatePicker
                  value={checkOut}
                  onChange={setCheckOut}
                  placeholder="Ημερομηνία"
                  minDate={checkIn || undefined}
                  highlightDate={checkIn || undefined}
                  initialMonth={checkIn || undefined}
                />
              </div>
            </div>

            {/* Results */}
            <div className="px-4 py-4">
              {!checkIn || !checkOut ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  Επιλέξτε ημερομηνίες για να δείτε διαθεσιμότητα και τιμές.
                </p>
              ) : loading ? (
                <p className="py-10 text-center text-sm text-gray-500">Υπολογισμός...</p>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{error}</div>
              ) : quote ? (
                <>
                  {/* Summary */}
                  <div className="mb-4 text-center">
                    <div className="text-3xl font-semibold text-gray-900">
                      {quote.availableCount} / {quote.totalProperties}
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      διαθέσιμα · {quote.nights} {quote.nights === 1 ? 'νύχτα' : 'νύχτες'} ·{' '}
                      {shortDate(quote.checkIn)} – {shortDate(quote.lastNight)}
                    </div>
                  </div>

                  {/* Available */}
                  {available.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900 mb-4">
                      Δεν υπάρχει διαθέσιμο κατάλυμα για αυτές τις ημερομηνίες.
                    </div>
                  ) : (
                    byBusiness(available).map(([business, list]) => (
                      <div key={business} className="mb-5">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{business}</h2>
                        <div className="space-y-2">
                          {list.map((p) => (
                            <div key={p.id} className="border border-gray-200 rounded-xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-3">
                                <div className="min-w-0">
                                  <div className="font-bold text-gray-900">{p.name}</div>
                                  {p.total !== null && (
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {euro(p.pricePerNight!)} / νύχτα
                                    </div>
                                  )}
                                </div>
                                {p.total !== null ? (
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="text-xl font-bold text-blue-600">{euro(p.total)}</div>
                                    <button
                                      onClick={() => copyLine(p)}
                                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Αντιγραφή για μήνυμα"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs font-semibold text-amber-700 flex-shrink-0">χωρίς τιμή</span>
                                )}
                              </div>

                              {/* Missing prices */}
                              {p.missingDates.length > 0 && (
                                <div className="bg-amber-50 border-t border-amber-200 px-4 py-2.5">
                                  <p className="text-xs text-amber-900">
                                    <span className="font-bold">Λείπουν τιμές</span> για{' '}
                                    {p.missingDates.length}{' '}
                                    {p.missingDates.length === 1 ? 'νύχτα' : 'νύχτες'}:{' '}
                                    {p.missingDates.map((d) => shortDate(d)).join(', ')}
                                  </p>
                                </div>
                              )}

                              {/* Breakdown, only when the stay crosses more than one range */}
                              {p.segments.length > 1 && (
                                <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 space-y-1">
                                  {p.segments.map((s, i) => (
                                    <div key={i} className="flex justify-between text-xs text-gray-600 tabular-nums">
                                      <span>
                                        {shortDate(s.from)}
                                        {s.nights > 1 ? ` – ${shortDate(s.to)}` : ''} · {s.nights} ×{' '}
                                        {euro(s.pricePerNight)}
                                      </span>
                                      <span className="font-semibold">{euro(s.subtotal)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Unavailable */}
                  {taken.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                        Κατειλημμένα ({taken.length})
                      </h2>
                      <div className="space-y-1.5">
                        {taken.map((p) => (
                          <div key={p.id} className="flex items-start justify-between gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-gray-700">{p.name}</span>
                              <span className="text-xs text-gray-400 ml-2">{p.businessName.split(' ')[0]}</span>
                            </div>
                            <div className="text-right text-xs text-gray-500 min-w-0">
                              {p.conflicts.slice(0, 2).map((c, i) => (
                                <div key={i} className="truncate">
                                  {c.label} · {shortDate(c.from)}–{shortDate(c.to)}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function QuotePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">Φόρτωση...</div>}>
      <QuoteContent />
    </Suspense>
  )
}
