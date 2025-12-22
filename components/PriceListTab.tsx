'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'
import DatePicker from './DatePicker'

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

  const handleUpdate = async (id: string) => {
    const range = priceRanges.find(r => r.id === id)
    if (!range) return

    try {
      const res = await fetch('/api/price-ranges', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(range)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Αποτυχία ενημέρωσης')
        return
      }

      fetchPriceRanges()
      setEditing(null)
      setError('')
    } catch (error) {
      console.error('Error updating price range:', error)
      setError('Αποτυχία ενημέρωσης')
    }
  }

  const handleDelete = async (groupKey: string) => {
    if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το εύρος τιμών από όλα τα καταλύματα;')) {
      return
    }

    try {
      // Find all price ranges with the same date range and price
      const rangesToDelete = priceRanges.filter(r =>
        `${r.dateFrom}-${r.dateTo}-${r.pricePerNight}` === groupKey
      )

      // Delete all matching ranges
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

  const groupedRangesList = Object.entries(groupedRanges).map(([key, value]) => ({
    key,
    ...value
  }))

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

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
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
        <h3 className="font-bold text-gray-900 mb-3">Υπάρχοντες Τιμοκατάλογοι</h3>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-gray-600 text-sm">Φόρτωση...</div>
          ) : groupedRangesList.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Δεν υπάρχουν τιμές
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
                          // Update all ranges in this group
                          for (const range of group.ranges) {
                            await handleUpdate(range.id)
                          }
                          setEditing(null)
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
                          onClick={() => handleDelete(group.key)}
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
