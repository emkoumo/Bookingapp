'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import DatePicker from './DatePicker'
import {
  type Lang,
  type Unit,
  UNIT_WORDS,
  type Night,
  nightsBetween,
  directPricesFor,
  groupNights,
  renderStayDates,
  renderPriceBlock,
  renderOption,
  renderPaymentInfo,
  fillTemplate,
  formatEuro,
  totalFor,
} from '@/lib/quickReply'

// Toast notification state
let toastTimeout: NodeJS.Timeout

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  subjectEl: string | null
  bodyEl: string | null
  imageUrl: string | null
  includeImageByDefault: boolean
}

interface PaymentMethod {
  id: string
  type: string
  label: string
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

interface Property {
  id: string
  name: string
}

interface PriceRange {
  dateFrom: string
  dateTo: string
  pricePerNight: string
}

/**
 * One stay being quoted. Prices typed by hand are kept per night as the raw
 * text, so clearing a box to retype does not snap back to the list price.
 */
interface Stay {
  id: string
  checkIn: string
  checkOut: string
  overrides: Record<string, string>
}

interface EmailComposerModalProps {
  template: EmailTemplate
  onClose: () => void
  onSaveTemplate: (template: EmailTemplate) => void
  businessId: string
}

const PRICED = ['availability_confirmation', 'alternative_dates', 'booking_confirmation']

const PLACEHOLDERS: Record<string, string[]> = {
  availability_confirmation: ['{{DATES}}', '{{PRICE}}'],
  alternative_dates: ['{{ALTERNATIVE_DATES}}'],
  booking_confirmation: ['{{DATES}}', '{{APARTMENTS}}', '{{PRICE}}', '{{PAYMENT_INFO}}'],
  no_availability: [],
}

const LANG_KEY = 'quickReplyLang'

function newStay(): Stay {
  return { id: Date.now().toString(), checkIn: '', checkOut: '', overrides: {} }
}

function parsePrice(text: string): number | null {
  const n = Number(text.replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

/** The price list's own prices for a stay, before anything typed by hand. */
function listPricesOf(stay: Stay, ranges: PriceRange[]): Night[] {
  if (!stay.checkIn || !stay.checkOut || stay.checkOut <= stay.checkIn) return []
  return directPricesFor(nightsBetween(stay.checkIn, stay.checkOut), ranges)
}

function copyWithTextarea(text: string) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  area.setSelectionRange(0, text.length) // iOS needs an explicit range
  const ok = document.execCommand('copy')
  document.body.removeChild(area)
  if (!ok) throw new Error('execCommand copy failed')
}

function nightsOf(stay: Stay, ranges: PriceRange[]): Night[] {
  return listPricesOf(stay, ranges).map((night) =>
    night.date in stay.overrides ? { ...night, price: parsePrice(stay.overrides[night.date]) } : night
  )
}

export default function EmailComposerModal({
  template,
  onClose,
  onSaveTemplate,
  businessId,
}: EmailComposerModalProps) {
  const [editedTemplate, setEditedTemplate] = useState(template)
  const [isEditingTemplate, setIsEditingTemplate] = useState(false)
  const [editLang, setEditLang] = useState<Lang>('en')
  const [lang, setLang] = useState<Lang>('en')
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  const [ranges, setRanges] = useState<PriceRange[]>([])
  const [unit, setUnit] = useState<Unit>('apartment')
  const [properties, setProperties] = useState<Property[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])

  // Up to three for alternative dates; one for the other priced replies.
  const [stays, setStays] = useState<Stay[]>([newStay()])
  const [apartmentCount, setApartmentCount] = useState(1)
  const [selectedApartments, setSelectedApartments] = useState<string[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [advancePayment, setAdvancePayment] = useState('')

  const priced = PRICED.includes(template.name)
  const hasGreek = !!template.bodyEl?.trim()

  // Sync editedTemplate when template prop changes (after save)
  useEffect(() => {
    setEditedTemplate(template)
  }, [template])

  // Remember the reply language between replies; Greek only when a Greek text exists.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY)
      if (saved === 'el' && hasGreek) setLang('el')
    } catch {}
  }, [hasGreek])

  const chooseLang = (next: Lang) => {
    setLang(next)
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {}
  }

  useEffect(() => {
    if (!priced) return
    loadPricing()
    if (template.name === 'booking_confirmation') loadPaymentMethods()
  }, [template.name, businessId])

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // Every apartment of a hotel carries the same price list (the price list
  // screen copies each range to all of them), so the first one is read.
  const loadPricing = async () => {
    try {
      const biz = await fetch('/api/businesses').then((r) => r.json())
      const mine = Array.isArray(biz) ? biz.find((b: { id: string }) => b.id === businessId) : null
      if (mine?.unitType === 'villa') setUnit('villa')
      const res = await fetch(`/api/properties?businessId=${businessId}`)
      const props: Property[] = await res.json()
      setProperties(props)
      if (props.length > 0) {
        const r = await fetch(`/api/price-ranges?propertyId=${props[0].id}`)
        setRanges(await r.json())
      }
    } catch (error) {
      console.error('Error loading prices:', error)
      showToast('Σφάλμα φόρτωσης τιμών', 'error')
    }
  }

  const loadPaymentMethods = async () => {
    try {
      const res = await fetch(`/api/payment-methods?businessId=${businessId}`)
      const data = await res.json()
      setPaymentMethods(data)
      if (data.length > 0) setSelectedPaymentMethod(data[0].id)
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    }
  }

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    clearTimeout(toastTimeout)
    toastTimeout = setTimeout(() => {
      setToastMessage('')
    }, 3000)
  }

  const updateStay = (id: string, patch: Partial<Stay>) => {
    setStays((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  const setNightPrices = (stay: Stay, dates: string[], text: string) => {
    const overrides = { ...stay.overrides }
    for (const d of dates) overrides[d] = text
    updateStay(stay.id, { overrides })
  }

  const toggleApartment = (id: string) => {
    setSelectedApartments((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))
  }

  const apartments = template.name === 'booking_confirmation' ? selectedApartments.length : apartmentCount
  const quoted = stays.map((stay) => ({ stay, nights: nightsOf(stay, ranges) }))
  const filledStays = quoted.filter((q) => q.nights.length > 0)
  const missingPrice = filledStays.some((q) => q.nights.some((n) => n.price === null))

  // What still has to be filled in before the reply can be copied.
  const blocker = useMemo(() => {
    if (!priced) return ''
    if (template.name === 'alternative_dates') {
      if (filledStays.length === 0) return 'Επιλέξτε τουλάχιστον μία περίοδο'
    } else if (filledStays.length === 0) {
      return 'Επιλέξτε ημερομηνίες'
    }
    if (missingPrice) return 'Συμπληρώστε τις τιμές που λείπουν'
    if (template.name === 'booking_confirmation') {
      if (selectedApartments.length === 0) return unit === 'villa' ? 'Επιλέξτε βίλα' : 'Επιλέξτε διαμέρισμα'
      if (!advancePayment.trim()) return 'Συμπληρώστε την προκαταβολή'
      if (!selectedPaymentMethod) return 'Επιλέξτε μέθοδο πληρωμής'
    }
    return ''
  }, [unit, priced, template.name, filledStays.length, missingPrice, selectedApartments.length, advancePayment, selectedPaymentMethod])

  const message = useMemo(() => {
    const body = lang === 'el' && hasGreek ? template.bodyEl! : template.body
    if (!priced) return fillTemplate(body, {})

    const values: Record<string, string> = {}
    const first = filledStays[0]
    const ready = !missingPrice

    if (template.name === 'alternative_dates') {
      values.ALTERNATIVE_DATES = ready
        ? filledStays
            .map((q, i) =>
              renderOption(i + 1, q.stay.checkIn, q.stay.checkOut, groupNights(q.nights), Math.max(apartments, 1), lang, unit)
            )
            .join('\n\n')
        : '[ ... ]'
    } else {
      values.DATES = first ? renderStayDates(first.stay.checkIn, first.stay.checkOut, lang) : '[ ... ]'
      values.PRICE = first && ready ? renderPriceBlock(groupNights(first.nights), Math.max(apartments, 1), lang, unit) : '[ ... ]'
    }

    if (template.name === 'booking_confirmation') {
      values.APARTMENTS =
        properties
          .filter((p) => selectedApartments.includes(p.id))
          .map((p) => p.name)
          .join(', ') || '[ ... ]'
      const method = paymentMethods.find((m) => m.id === selectedPaymentMethod)
      values.PAYMENT_INFO = method && advancePayment.trim() ? renderPaymentInfo(method, advancePayment, lang) : '[ ... ]'
    }

    return fillTemplate(body, values)
  }, [lang, hasGreek, template, priced, filledStays, missingPrice, apartments, properties, selectedApartments, paymentMethods, selectedPaymentMethod, advancePayment, unit])

  const copyMessage = async () => {
    try {
      // navigator.clipboard exists only on https and localhost; on a plain-http
      // address (e.g. testing from a phone on the LAN) fall back to execCommand.
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(message)
      } else {
        copyWithTextarea(message)
      }
      showToast('Αντιγράφηκε!')
    } catch (err) {
      console.error('Copy text error:', err)
      showToast('Σφάλμα αντιγραφής', 'error')
    }
  }

  const getTemplateName = (name: string) => {
    switch (name) {
      case 'no_availability':
        return 'Μη Διαθεσιμότητα'
      case 'alternative_dates':
        return 'Εναλλακτικές Ημερομηνίες'
      case 'availability_confirmation':
        return 'Επιβεβαίωση Διαθεσιμότητας'
      case 'booking_confirmation':
        return 'Στοιχεία Πληρωμής'
      default:
        return name
    }
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  const datePair = (stay: Stay) => (
    <div className="flex-1 grid grid-cols-2 gap-2">
      <DatePicker
        value={stay.checkIn}
        onChange={(date) => updateStay(stay.id, { checkIn: date, overrides: {} })}
        placeholder="Check-in"
        isEditMode={false}
        minDate={today}
        maxDate={stay.checkOut || undefined}
        highlightDate={stay.checkOut || undefined}
      />
      <DatePicker
        value={stay.checkOut}
        onChange={(date) => updateStay(stay.id, { checkOut: date, overrides: {} })}
        placeholder="Check-out"
        isEditMode={false}
        minDate={stay.checkIn || today}
        highlightDate={stay.checkIn || undefined}
        initialMonth={stay.checkIn || undefined}
      />
    </div>
  )

  const segmentButton = (active: boolean) =>
    `flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
      active ? 'bg-white text-blue-700 shadow' : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 md:flex md:items-center md:justify-center z-[70] md:p-4 overflow-y-auto">
      <div className="bg-white h-full md:h-auto md:rounded-2xl shadow-2xl md:max-w-4xl w-full md:my-8 animate-scale-in flex flex-col md:max-h-[90vh]">
        {/* Header - Sticky on mobile */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 md:px-6 py-4 md:rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-bold text-white">{getTemplateName(template.name)}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:opacity-80 transition-opacity text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Toggle: Reply vs Edit Template */}
          <div className="flex gap-2 border-b border-gray-200 pb-3">
            <button
              onClick={() => setIsEditingTemplate(false)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                !isEditingTemplate ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Απάντηση
            </button>
            <button
              onClick={() => setIsEditingTemplate(true)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isEditingTemplate ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Επεξεργασία Κειμένου
            </button>
          </div>

          {!isEditingTemplate ? (
            <>
              {/* Reply language */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => chooseLang('el')}
                  disabled={!hasGreek}
                  title={hasGreek ? undefined : 'Δεν υπάρχει ελληνικό κείμενο. Προσθέστε το από την Επεξεργασία Κειμένου.'}
                  className={`${segmentButton(lang === 'el')} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  Ελληνικά
                </button>
                <button onClick={() => chooseLang('en')} className={segmentButton(lang === 'en')}>
                  English
                </button>
              </div>

              {/* Dates */}
              {priced && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {template.name === 'alternative_dates' ? 'Εναλλακτικές Περίοδοι' : 'Ημερομηνίες'}
                  </label>
                  <div className="space-y-3">
                    {stays.map((stay, index) => (
                      <div key={stay.id} className="flex items-center gap-2">
                        {datePair(stay)}
                        {index > 0 && (
                          <button
                            onClick={() => setStays(stays.filter((s) => s.id !== stay.id))}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            aria-label="Αφαίρεση περιόδου"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {template.name === 'alternative_dates' && stays.length < 3 && (
                      <button
                        onClick={() => setStays([...stays, newStay()])}
                        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors font-medium"
                      >
                        + Προσθήκη Περιόδου (max 3)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Apartments */}
              {priced && template.name !== 'booking_confirmation' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{unit === 'villa' ? 'Αριθμός βιλών' : 'Αριθμός διαμερισμάτων'}</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setApartmentCount(Math.max(1, apartmentCount - 1))}
                      className="w-11 h-11 rounded-lg border-2 border-gray-300 text-xl font-bold text-gray-700 hover:border-blue-500"
                      aria-label="Λιγότερα"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-lg font-bold">{apartmentCount}</span>
                    <button
                      onClick={() => setApartmentCount(Math.min(Math.max(properties.length, 1), apartmentCount + 1))}
                      className="w-11 h-11 rounded-lg border-2 border-gray-300 text-xl font-bold text-gray-700 hover:border-blue-500"
                      aria-label="Περισσότερα"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
              {template.name === 'booking_confirmation' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{unit === 'villa' ? 'Βίλες κράτησης' : 'Διαμερίσματα κράτησης'}</label>
                  <div className="flex flex-wrap gap-2">
                    {properties.map((p) => {
                      const on = selectedApartments.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleApartment(p.id)}
                          aria-pressed={on}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                            on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                          }`}
                        >
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Nightly prices, editable */}
              {filledStays.map(({ stay, nights }, i) => (
                <PriceEditor
                  key={stay.id}
                  title={filledStays.length > 1 ? `Τιμές · Περίοδος ${i + 1}` : 'Τιμές'}
                  nights={nights}
                  listPrices={listPricesOf(stay, ranges)}
                  overrides={stay.overrides}
                  apartments={Math.max(apartments, 1)}
                  unit={unit}
                  onSet={(dates, text) => setNightPrices(stay, dates, text)}
                  onReset={() => updateStay(stay.id, { overrides: {} })}
                />
              ))}

              {/* Payment */}
              {template.name === 'booking_confirmation' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Ποσό προκαταβολής</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={advancePayment}
                      onChange={(e) => setAdvancePayment(e.target.value)}
                      placeholder="π.χ. 300"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Μέθοδος Πληρωμής</label>
                    {paymentMethods.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {paymentMethods.map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setSelectedPaymentMethod(method.id)}
                            className={`flex-1 min-w-[140px] p-2 rounded-lg border-2 transition-all ${
                              selectedPaymentMethod === method.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="text-left">
                              <div className="font-semibold text-gray-900 text-sm truncate">{method.label}</div>
                              <div className="text-xs text-gray-600 truncate mt-0.5">
                                {method.type === 'western_union' ? method.details.fullName : method.details.bankName}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
                        Δεν υπάρχουν μέθοδοι πληρωμής. Προσθέστε μία από το εικονίδιο στην κορυφή.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Message preview */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Προεπισκόπηση μηνύματος</label>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 whitespace-pre-wrap text-[15px] leading-relaxed">
                  {message}
                </div>
              </div>
            </>
          ) : (
            /* Template Editor */
            <>
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button onClick={() => setEditLang('el')} className={segmentButton(editLang === 'el')}>
                  Ελληνικά
                </button>
                <button onClick={() => setEditLang('en')} className={segmentButton(editLang === 'en')}>
                  English
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Θέμα (για email)</label>
                <input
                  type="text"
                  value={(editLang === 'el' ? editedTemplate.subjectEl : editedTemplate.subject) ?? ''}
                  onChange={(e) =>
                    setEditedTemplate({
                      ...editedTemplate,
                      ...(editLang === 'el' ? { subjectEl: e.target.value } : { subject: e.target.value }),
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Κείμενο ({editLang === 'el' ? 'Ελληνικά' : 'English'})
                </label>
                <textarea
                  rows={18}
                  value={(editLang === 'el' ? editedTemplate.bodyEl : editedTemplate.body) ?? ''}
                  onChange={(e) =>
                    setEditedTemplate({
                      ...editedTemplate,
                      ...(editLang === 'el' ? { bodyEl: e.target.value } : { body: e.target.value }),
                    })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
                />
                {PLACEHOLDERS[template.name]?.length > 0 && (
                  <p className="text-xs text-gray-600 mt-2">
                    Συμπληρώνονται αυτόματα: {PLACEHOLDERS[template.name].join(' · ')}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer - Sticky */}
        <div className="bg-white border-t border-gray-200 px-4 md:px-6 py-4 md:rounded-b-2xl sticky bottom-0">
          {!isEditingTemplate && blocker && (
            <p className="text-sm text-amber-700 text-center mb-2">{blocker}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
            >
              {isEditingTemplate ? 'Κλείσιμο' : 'Ακύρωση'}
            </button>
            {isEditingTemplate ? (
              <button
                onClick={() => onSaveTemplate(editedTemplate)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md"
              >
                Αποθήκευση
              </button>
            ) : (
              <button
                onClick={copyMessage}
                disabled={!!blocker}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-opacity shadow-md ${
                  blocker
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90'
                }`}
              >
                Αντιγραφή
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[80] animate-slide-in">
          <div
            className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 ${
              toastType === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            <span className="text-lg font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Nights grouped by price, each group editable as a whole, with the option to
 * open a group and set single nights. A night with no price is shown in red.
 */
function PriceEditor({
  title,
  nights,
  listPrices,
  overrides,
  apartments,
  unit,
  onSet,
  onReset,
}: {
  title: string
  nights: Night[]
  listPrices: Night[]
  overrides: Record<string, string>
  apartments: number
  unit: Unit
  onSet: (dates: string[], text: string) => void
  onReset: () => void
}) {
  const [open, setOpen] = useState<string | null>(null)

  // Rows follow the price list's own periods, not the edited prices, so a row
  // never merges with its neighbour (and loses focus) while a price is typed.
  const rows: Night[][] = []
  nights.forEach((night, i) => {
    const last = rows[rows.length - 1]
    if (last && listPrices[i - 1].price === listPrices[i].price) last.push(night)
    else rows.push([night])
  })

  const shown = (n: Night) => (n.date in overrides ? overrides[n.date] : n.price === null ? '' : String(n.price))
  const label = (d: string) => format(new Date(d + 'T00:00:00'), 'd/M')
  const complete = nights.every((n) => n.price !== null)
  const edited = Object.keys(overrides).length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-bold text-gray-700">{title}</label>
        {edited && (
          <button onClick={onReset} className="text-xs text-blue-600 hover:underline">
            Επαναφορά τιμοκαταλόγου
          </button>
        )}
      </div>
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
        {rows.map((row) => {
          const first = row[0]
          const missing = row.some((n) => n.price === null)
          const mixed = row.some((n) => shown(n) !== shown(first))
          const key = first.date
          const checkout = format(new Date(new Date(row[row.length - 1].date + 'T00:00:00').getTime() + 86400000), 'd/M')
          return (
            <div key={key} className={missing ? 'bg-red-50' : ''}>
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {label(first.date)} – {checkout}
                  </div>
                  <div className={`text-xs ${missing ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
                    {row.length} {row.length === 1 ? 'νύχτα' : 'νύχτες'}
                    {missing ? ' · χωρίς τιμή' : ''}
                    {mixed ? ' · διαφορετικές τιμές' : ''}
                  </div>
                </div>
                <div className="relative w-24">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={mixed ? '' : shown(first)}
                    onChange={(e) => onSet(row.map((n) => n.date), e.target.value)}
                    placeholder={mixed ? 'όλες' : 'τιμή'}
                    aria-label={`Τιμή ανά νύχτα ${label(first.date)} – ${checkout}`}
                    className={`w-full pl-3 pr-7 py-2 border-2 rounded-lg text-right focus:outline-none ${
                      missing ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-blue-500'
                    }`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">€</span>
                </div>
                {row.length > 1 && (
                  <button
                    onClick={() => setOpen(open === key ? null : key)}
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                  >
                    {open === key ? 'Κλείσιμο' : 'Ανά νύχτα'}
                  </button>
                )}
              </div>
              {open === key && row.length > 1 && (
                <div className="px-3 pb-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {row.map((n) => (
                    <label key={n.date} className="text-xs text-gray-600">
                      {label(n.date)}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={shown(n)}
                        onChange={(e) => onSet([n.date], e.target.value)}
                        className="mt-1 w-full px-2 py-1.5 border-2 border-gray-300 rounded-lg text-right text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {complete && (
        <div className="text-right text-sm font-bold text-gray-900 mt-2">
          Σύνολο: {formatEuro(totalFor(groupNights(nights), apartments))}
          {apartments > 1 && <span className="font-normal text-gray-600"> ({apartments} {UNIT_WORDS[unit].el.many})</span>}
        </div>
      )}
    </div>
  )
}
