'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'
import DatePicker from './DatePicker'
import { currentYear } from '@/lib/year'

interface Property {
  id: string
  name: string
}

interface PriceRange {
  id: string
  propertyId: string
  dateFrom: string
  dateTo: string
  pricePerNight: number
  createdAt: string
  updatedAt: string
}

interface PriceListTabProps {
  properties: Property[]
  businessId: string
}

export default function PriceListTab({ properties, businessId }: PriceListTabProps) {
  const [priceRanges, setPriceRanges] = useState<PriceRange[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    dateFrom: '',
    dateTo: '',
    pricePerNight: ''
  })
  const [error, setError] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(currentYear())
  const [uplift, setUplift] = useState<string>('0')
  const [copying, setCopying] = useState(false)
  const [notice, setNotice] = useState<string>('')

  // Fetch price ranges on mount
  useEffect(() => {
    if (properties.length > 0) {
      fetchPriceRanges()
    }
  }, [properties])

  const fetchPriceRanges = async () => {
    if (properties.length === 0) return

    setLoading(true)
    try {
      // Fetch price ranges for all properties
      const allRanges: PriceRange[] = []
      for (const property of properties) {
        const res = await fetch(`/api/price-ranges?propertyId=${property.id}`)
        const data = await res.json()
        allRanges.push(...data)
      }
      setPriceRanges(allRanges)
      setError('')
    } catch (error) {
      console.error('Error fetching price ranges:', error)
      setError('Αποτυχία φόρτωσης τιμοκαταλόγου')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!formData.dateFrom || !formData.dateTo || !formData.pricePerNight) {
      setError('Παρακαλώ συμπληρώστε όλα τα πεδία')
      return
    }

    if (parseFloat(formData.pricePerNight) <= 0) {
      setError('Η τιμή πρέπει να είναι μεγαλύτερη από 0')
      return
    }

    try {
      // Add price range to ALL properties automatically
      let hasError = false
      let errorMessage = ''

      for (const property of properties) {
        const res = await fetch('/api/price-ranges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: property.id,
            dateFrom: formData.dateFrom,
            dateTo: formData.dateTo,
            pricePerNight: parseFloat(formData.pricePerNight)
          })
        })

        const data = await res.json()

        if (!res.ok) {
          hasError = true
          errorMessage = `${property.name}: ${data.error || 'Αποτυχία προσθήκης'}`
          break
        }
      }

      if (hasError) {
        setError(errorMessage)
        return
      }

      fetchPriceRanges()
      setFormData({ dateFrom: '', dateTo: '', pricePerNight: '' })
      setError('')
    } catch (error) {
      console.error('Error adding price range:', error)
      setError('Αποτυχία προσθήκης')
    }
  }

  const handleUpdate = async (id: string): Promise<boolean> => {
    const range = priceRanges.find(r => r.id === id)
    if (!range) return false

    // The API expects YYYY-MM-DD and appends its own time component. Strip any
    // ISO time suffix that may already be on the date (the GET returns full
    // ISO strings) before sending, otherwise the server tries to parse
    // "2026-06-01T00:00:00.000ZT00:00:00.000Z" and crashes with 500.
    const dateOnly = (d: string) => d?.includes('T') ? d.split('T')[0] : d

    try {
      const res = await fetch('/api/price-ranges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: range.id,
          dateFrom: dateOnly(range.dateFrom),
          dateTo: dateOnly(range.dateTo),
          pricePerNight: range.pricePerNight,
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Αποτυχία ενημέρωσης')
        return false
      }

      setError('')
      return true
    } catch (error) {
      console.error('Error updating price range:', error)
      setError('Αποτυχία ενημέρωσης')
      return false
    }
  }

  const handleDeleteGroup = async (rangesToDelete: PriceRange[]) => {
    if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το εύρος τιμών από όλα τα καταλύματα;')) {
      return
    }

    try {
      for (const range of rangesToDelete) {
        await fetch(`/api/price-ranges?id=${range.id}`, {
          method: 'DELETE'
        })
      }

      fetchPriceRanges()
      setError('')
    } catch (error) {
      console.error('Error deleting price range:', error)
      setError('Αποτυχία διαγραφής')
    }
  }

  // Group price ranges by date range and price
  const groupedRanges = priceRanges.reduce((acc, range) => {
    const key = `${range.dateFrom}-${range.dateTo}-${range.pricePerNight}`
    if (!acc[key]) {
      acc[key] = {
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        pricePerNight: range.pricePerNight,
        ranges: []
      }
    }
    acc[key].ranges.push(range)
    return acc
  }, {} as Record<string, {
    dateFrom: string
    dateTo: string
    pricePerNight: number
    ranges: PriceRange[]
  }>)

  // Use the first range's id as a stable identifier — composite date/price
  // keys mutate the moment the user edits any field, which would unmount the
  // inline edit form mid-edit. Range ids don't change on update.
  const allGroupedRanges = Object.entries(groupedRanges).map(([compositeKey, value]) => ({
    key: value.ranges[0]?.id ?? compositeKey,
    ...value
  }))

  // Years that actually hold entries, plus the current and next season so a new
  // year is always reachable before it has any prices in it.
  const yearsWithData = Array.from(
    new Set(priceRanges.map((r) => Number(r.dateFrom.slice(0, 4))))
  )
  const years = Array.from(
    new Set([...yearsWithData, currentYear(), currentYear() + 1])
  ).sort((a, b) => a - b)

  const countForYear = (y: number) =>
    allGroupedRanges.filter((g) => Number(g.dateFrom.slice(0, 4)) === y).length

  const groupedRangesList = allGroupedRanges
    .filter((g) => Number(g.dateFrom.slice(0, 4)) === selectedYear)
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))

  // Offer to copy from the most recent earlier year that has prices.
  const sourceYear = yearsWithData
    .filter((y) => y < selectedYear)
    .sort((a, b) => b - a)[0]

  const handleCopyYear = async () => {
    if (!sourceYear) return
    setCopying(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch('/api/price-ranges/copy-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          fromYear: sourceYear,
          toYear: selectedYear,
          upliftPercent: parseFloat(uplift) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Αποτυχία αντιγραφής')
        return
      }
      setNotice(
        `Αντιγράφηκαν ${data.created} καταχωρήσεις από ${sourceYear} στο ${selectedYear}` +
          (data.upliftPercent ? ` με ${data.upliftPercent > 0 ? '+' : ''}${data.upliftPercent}%.` : '.')
      )
      await fetchPriceRanges()
    } catch (err) {
      console.error('Error copying year:', err)
      setError('Αποτυχία αντιγραφής')
    } finally {
      setCopying(false)
    }
  }

  // Format date range as "1-31 May 2026"
  const formatDateRange = (dateFrom: string, dateTo: string) => {
    const from = new Date(dateFrom)
    const to = new Date(dateTo)

    const dayFrom = format(from, 'd')
    const dayTo = format(to, 'd')
    const month = format(from, 'MMMM', { locale: el })
    const year = format(from, 'yyyy')

    return `${dayFrom}-${dayTo} ${month} ${year}`
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        Δεν υπάρχουν διαθέσιμα ακίνητα
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <span className="font-bold">Σημείωση:</span> Οι τιμές που ορίζετε εφαρμόζονται αυτόματα σε όλα τα καταλύματα ({properties.length} {properties.length === 1 ? 'κατάλυμα' : 'καταλύματα'}).
        </p>
      </div>

      {/* Season tabs */}
      <div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => { setSelectedYear(y); setNotice(''); setError('') }}
              className={`shrink-0 px-3 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                selectedYear === y ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{y}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                selectedYear === y ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-700'
              }`}>
                {countForYear(y)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
          {notice}
        </div>
      )}

      {/* Copy last season forward — only offered when this year is still empty,
          so it can never be used to duplicate over existing prices. */}
      {countForYear(selectedYear) === 0 && sourceYear && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-bold text-gray-900 mb-1 text-sm">
            Αντιγραφή τιμοκαταλόγου {sourceYear} → {selectedYear}
          </h3>
          <p className="text-xs text-gray-600 mb-3">
            Αντιγράφει τις ίδιες ημερομηνίες και τιμές στη νέα χρονιά, για όλα τα καταλύματα.
            Δεν αλλάζει τίποτα από το {sourceYear}.
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">Αύξηση (%)</label>
              <input
                type="number"
                step="0.5"
                value={uplift}
                onChange={(e) => setUplift(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="0"
              />
            </div>
            <button
              onClick={handleCopyYear}
              disabled={copying}
              className="px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold text-sm disabled:opacity-50 whitespace-nowrap"
            >
              {copying ? 'Αντιγραφή...' : 'Αντιγραφή'}
            </button>
          </div>
        </div>
      )}

      {/* Add New Price Range */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-bold text-gray-900 mb-3 text-sm">Προσθήκη Νέου Εύρους Τιμών</h3>

        {/* Dates - Using DatePicker Component */}
        <div>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <label className="block text-sm font-bold text-gray-700">Από *</label>
            <label className="block text-sm font-bold text-gray-700">Έως *</label>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <DatePicker
              value={formData.dateFrom}
              onChange={(date) => setFormData({ ...formData, dateFrom: date })}
              placeholder="Ημερομηνία"
              minDate={format(new Date(), 'yyyy-MM-dd')}
              maxDate={formData.dateTo || undefined}
              highlightDate={formData.dateTo || undefined}
            />
            <DatePicker
              value={formData.dateTo}
              onChange={(date) => setFormData({ ...formData, dateTo: date })}
              placeholder="Ημερομηνία"
              minDate={formData.dateFrom || format(new Date(), 'yyyy-MM-dd')}
              highlightDate={formData.dateFrom || undefined}
              initialMonth={formData.dateFrom || undefined}
            />
          </div>
        </div>

        {/* Price Input */}
        <div className="mb-3">
          <label className="block text-sm font-bold text-gray-700 mb-2">Τιμή/Νύχτα (€) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.pricePerNight}
            onChange={(e) => setFormData({ ...formData, pricePerNight: e.target.value })}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            placeholder="0.00"
          />
        </div>

        <button
          onClick={handleAdd}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md"
        >
          Προσθήκη σε όλα τα καταλύματα
        </button>
      </div>

      {/* Existing Price Ranges - Grouped by date/price */}
      <div>
        <h3 className="font-bold text-gray-900 mb-3">Τιμοκατάλογοι {selectedYear}</h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-600 text-sm">Φόρτωση...</div>
          ) : groupedRangesList.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Δεν υπάρχουν τιμές για το {selectedYear}
            </div>
          ) : (
            groupedRangesList.map((group) => (
              <div key={group.key} className="bg-white border border-gray-200 rounded-xl p-4">
                {editing === group.key ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Από</label>
                        <input
                          type="date"
                          value={group.dateFrom.split('T')[0]}
                          onChange={(e) => {
                            // Update all ranges in this group
                            const newDateFrom = e.target.value
                            setPriceRanges(priceRanges.map(r =>
                              group.ranges.some(gr => gr.id === r.id) ? { ...r, dateFrom: newDateFrom } : r
                            ))
                          }}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Έως</label>
                        <input
                          type="date"
                          value={group.dateTo.split('T')[0]}
                          onChange={(e) => {
                            // Update all ranges in this group
                            const newDateTo = e.target.value
                            setPriceRanges(priceRanges.map(r =>
                              group.ranges.some(gr => gr.id === r.id) ? { ...r, dateTo: newDateTo } : r
                            ))
                          }}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Τιμή/Νύχτα (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={Number(group.pricePerNight)}
                          onChange={(e) => {
                            // Update all ranges in this group
                            const newPrice = parseFloat(e.target.value)
                            setPriceRanges(priceRanges.map(r =>
                              group.ranges.some(gr => gr.id === r.id) ? { ...r, pricePerNight: newPrice } : r
                            ))
                          }}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          let allOk = true
                          for (const range of group.ranges) {
                            const ok = await handleUpdate(range.id)
                            if (!ok) allOk = false
                          }
                          // Refresh from server so UI matches whatever actually persisted
                          await fetchPriceRanges()
                          // Only close the form if every property's range saved successfully —
                          // otherwise leave the form open with the error visible
                          if (allOk) setEditing(null)
                        }}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity"
                      >
                        Αποθήκευση
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold transition-colors"
                      >
                        Ακύρωση
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">
                          {formatDateRange(group.dateFrom, group.dateTo)}
                        </p>
                        <p className="text-2xl font-bold text-blue-600">€{Number(group.pricePerNight).toFixed(2)}<span className="text-sm text-gray-600">/νύχτα</span></p>
                        <p className="text-xs text-gray-500 mt-1">Εφαρμόζεται σε όλα τα καταλύματα</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditing(group.key)}
                          className="p-2 text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Επεξεργασία"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.ranges)}
                          className="p-2 text-red-600 border border-red-300 hover:bg-red-50 rounded-lg transition-colors"
                          title="Διαγραφή"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
