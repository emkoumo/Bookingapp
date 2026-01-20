'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { el } from 'date-fns/locale'
import DatePicker from './DatePicker'
import Modal from './Modal'

interface Property {
  id: string
  name: string
}

interface Booking {
  id: string
  checkIn: string
  checkOut: string
  property: Property
  status: string
}

interface BlockedDate {
  id: string
  propertyId: string
  startDate: string
  endDate: string
  property: Property
  createdAt: string
  updatedAt: string
}

interface BlockManagementModalProps {
  properties: Property[]
  bookings: Booking[]
  businessId: string
  onClose: () => void
  onUpdate: () => void
  initialScrollToId?: string | null
}

export default function BlockManagementModal({
  properties,
  bookings,
  businessId,
  onClose,
  onUpdate,
  initialScrollToId
}: BlockManagementModalProps) {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    propertyIds: [] as string[],
    startDate: '',
    endDate: ''
  })
  const [error, setError] = useState<string>('')
  const [disabledDates, setDisabledDates] = useState<string[]>([])
  const [disabledCheckoutDates, setDisabledCheckoutDates] = useState<string[]>([])
  const [modal, setModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  // Fetch blocked dates on mount
  useEffect(() => {
    fetchBlockedDates()
  }, [])

  // Calculate disabled dates for the form
  useEffect(() => {
    const calculateDisabledDates = () => {
      const disabled: string[] = []

      formData.propertyIds.forEach((propertyId) => {
        // Add booked dates
        const propertyBookings = bookings.filter(
          (b) => b.property.id === propertyId && b.status === 'active'
        )

        propertyBookings.forEach((booking) => {
          try {
            const start = parseISO(booking.checkIn)
            const end = parseISO(booking.checkOut)
            const endMinusOne = new Date(end.getTime() - 24 * 60 * 60 * 1000)

            const dates = eachDayOfInterval({ start, end: endMinusOne })

            dates.forEach((date) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              if (!disabled.includes(dateStr)) {
                disabled.push(dateStr)
              }
            })
          } catch (error) {
            console.error('Error parsing booking dates:', error)
          }
        })

        // Add other blocked dates (excluding current one if editing)
        const otherBlockedDates = blockedDates.filter(
          (b) => b.propertyId === propertyId && (!editing || b.id !== editing)
        )

        otherBlockedDates.forEach((blocked) => {
          try {
            const start = parseISO(blocked.startDate)
            const end = parseISO(blocked.endDate)

            const dates = eachDayOfInterval({ start, end })

            dates.forEach((date) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              if (!disabled.includes(dateStr)) {
                disabled.push(dateStr)
              }
            })
          } catch (error) {
            console.error('Error parsing blocked dates:', error)
          }
        })
      })

      setDisabledDates(disabled)
    }

    calculateDisabledDates()
  }, [formData.propertyIds, bookings, blockedDates, editing])

  // Calculate disabled checkout dates
  useEffect(() => {
    if (!formData.startDate) {
      setDisabledCheckoutDates([])
      return
    }

    const disabled: string[] = []
    const checkInDate = parseISO(formData.startDate)

    // Check 365 days ahead
    for (let i = 1; i <= 365; i++) {
      const potentialCheckOut = new Date(checkInDate)
      potentialCheckOut.setDate(potentialCheckOut.getDate() + i)
      const potentialCheckOutStr = format(potentialCheckOut, 'yyyy-MM-dd')

      // Get dates between checkIn and potentialCheckOut (excluding endpoints)
      const start = new Date(checkInDate)
      start.setDate(start.getDate() + 1)
      const end = new Date(potentialCheckOut)
      end.setDate(end.getDate() - 1)

      if (start <= end) {
        const datesInBetween = eachDayOfInterval({ start, end })
        const hasDisabledDate = datesInBetween.some((date) =>
          disabledDates.includes(format(date, 'yyyy-MM-dd'))
        )

        if (hasDisabledDate) {
          disabled.push(potentialCheckOutStr)
        }
      }
    }

    setDisabledCheckoutDates(disabled)
  }, [formData.startDate, disabledDates])

  const fetchBlockedDates = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/blocked-dates?businessId=${businessId}`)
      if (res.ok) {
        const data = await res.json()
        setBlockedDates(Array.isArray(data) ? data : [])
      }
      setError('')
    } catch (error) {
      console.error('Error fetching blocked dates:', error)
      setError('Αποτυχία φόρτωσης μπλοκαρισμάτων')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (formData.propertyIds.length === 0) {
      setError('Παρακαλώ επιλέξτε τουλάχιστον ένα κατάλυμα')
      return
    }

    if (!formData.startDate || !formData.endDate) {
      setError('Παρακαλώ επιλέξτε ημερομηνίες έναρξης και λήξης')
      return
    }

    try {
      const res = await fetch('/api/blocked-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Αποτυχία προσθήκης')
        return
      }

      await fetchBlockedDates()
      setFormData({ propertyIds: [], startDate: '', endDate: '' })
      setError('')
      onUpdate()
    } catch (error) {
      console.error('Error adding blocked date:', error)
      setError('Αποτυχία προσθήκης')
    }
  }

  const handleUpdate = async (id: string) => {
    const blocked = blockedDates.find(b => b.id === id)
    if (!blocked) return

    try {
      const res = await fetch(`/api/blocked-dates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: blocked.startDate,
          endDate: blocked.endDate
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Αποτυχία ενημέρωσης')
        return
      }

      await fetchBlockedDates()
      setEditing(null)
      setError('')
      onUpdate()
    } catch (error) {
      console.error('Error updating blocked date:', error)
      setError('Αποτυχία ενημέρωσης')
    }
  }

  const handleDelete = async (groupKey: string) => {
    setModal({
      title: 'Επιβεβαίωση Διαγραφής',
      message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το μπλοκάρισμα;',
      onConfirm: async () => {
        setModal(null)
        try {
          // Find all blocked dates with the same date range
          const blocksToDelete = blockedDates.filter(b =>
            `${b.startDate}-${b.endDate}` === groupKey
          )

          // Delete all matching blocks
          for (const block of blocksToDelete) {
            await fetch(`/api/blocked-dates/${block.id}`, {
              method: 'DELETE'
            })
          }

          await fetchBlockedDates()
          setError('')
          onUpdate()
        } catch (error) {
          console.error('Error deleting blocked date:', error)
          setError('Αποτυχία διαγραφής')
        }
      }
    })
  }

  const handlePropertyToggle = (propertyId: string) => {
    setFormData((prev) => ({
      ...prev,
      propertyIds: prev.propertyIds.includes(propertyId)
        ? prev.propertyIds.filter((id) => id !== propertyId)
        : [...prev.propertyIds, propertyId]
    }))
  }

  // Group blocked dates by date range
  const groupedBlocks = blockedDates.reduce((acc, block) => {
    const key = `${block.startDate}-${block.endDate}`
    if (!acc[key]) {
      acc[key] = {
        startDate: block.startDate,
        endDate: block.endDate,
        blocks: []
      }
    }
    acc[key].blocks.push(block)
    return acc
  }, {} as Record<string, {
    startDate: string
    endDate: string
    blocks: BlockedDate[]
  }>)

  const groupedBlocksList = Object.entries(groupedBlocks).map(([key, value]) => ({
    key,
    ...value
  }))

  // Format date range as "1-31 Μαΐου 2026"
  const formatDateRange = (startDate: string, endDate: string) => {
    const from = new Date(startDate)
    const to = new Date(endDate)

    const dayFrom = format(from, 'd')
    const dayTo = format(to, 'd')
    const month = format(from, 'MMMM', { locale: el })
    const year = format(from, 'yyyy')

    return `${dayFrom}-${dayTo} ${month} ${year}`
  }

  if (properties.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Διαχείριση Μπλοκαρισμάτων</h3>
              <button onClick={onClose} className="text-white hover:opacity-80 text-2xl">×</button>
            </div>
          </div>
          <div className="p-6 text-center text-gray-600">
            Δεν υπάρχουν διαθέσιμα καταλύματα
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {modal && (
        <Modal
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
          confirmText="Διαγραφή"
          cancelText="Ακύρωση"
          type="danger"
        />
      )}
      <div className="fixed inset-0 bg-black bg-opacity-50 md:flex md:items-center md:justify-center z-[70] md:p-4 overflow-y-auto">
      <div className="bg-white h-full md:h-auto md:max-h-[90vh] md:rounded-2xl shadow-2xl md:max-w-4xl w-full md:my-8 flex flex-col">
        {/* Header - Red theme */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 md:px-6 py-4 md:rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-bold text-white">Διαχείριση Μπλοκαρισμάτων</h3>
            <button
              onClick={onClose}
              className="text-white hover:opacity-80 transition-opacity text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Add New Block */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="font-bold text-gray-900 mb-3 text-sm">Προσθήκη Νέου Μπλοκαρίσματος</h3>

            {/* Property Selection */}
            <div className="mb-3">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Καταλύματα <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {properties.map((property) => (
                  <button
                    key={property.id}
                    type="button"
                    onClick={() => handlePropertyToggle(property.id)}
                    className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${
                      formData.propertyIds.includes(property.id)
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-red-300'
                    }`}
                  >
                    {property.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <label className="block text-sm font-bold text-gray-700">
                  Από <span className="text-red-500">*</span>
                </label>
                <label className="block text-sm font-bold text-gray-700">
                  Έως <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <DatePicker
                  value={formData.startDate}
                  onChange={(dateStr) =>
                    setFormData((prev) => ({
                      ...prev,
                      startDate: dateStr,
                      endDate: ''
                    }))
                  }
                  disabledDates={disabledDates}
                  minDate={format(new Date(), 'yyyy-MM-dd')}
                  placeholder="Ημερομηνία"
                />
                <DatePicker
                  value={formData.endDate}
                  onChange={(dateStr) =>
                    setFormData((prev) => ({
                      ...prev,
                      endDate: dateStr
                    }))
                  }
                  disabledDates={[...disabledDates, ...disabledCheckoutDates]}
                  minDate={formData.startDate || format(new Date(), 'yyyy-MM-dd')}
                  highlightDate={formData.startDate}
                  initialMonth={formData.startDate}
                  placeholder="Ημερομηνία"
                />
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={formData.propertyIds.length === 0 || !formData.startDate || !formData.endDate}
              className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Προσθήκη Μπλοκαρίσματος
            </button>
          </div>

          {/* Existing Blocked Dates - Grouped by date range */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3">Υπάρχοντα Μπλοκαρίσματα</h3>
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-gray-600 text-sm">Φόρτωση...</div>
              ) : groupedBlocksList.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  Δεν υπάρχουν μπλοκαρίσματα
                </div>
              ) : (
                groupedBlocksList.map((group) => (
                  <div key={group.key} className="bg-white border border-gray-200 rounded-xl p-4">
                    {editing === group.key ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Από</label>
                            <input
                              type="date"
                              value={group.startDate.split('T')[0]}
                              onChange={(e) => {
                                const newStartDate = e.target.value
                                setBlockedDates(blockedDates.map(b =>
                                  group.blocks.some(gb => gb.id === b.id) ? { ...b, startDate: newStartDate } : b
                                ))
                              }}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Έως</label>
                            <input
                              type="date"
                              value={group.endDate.split('T')[0]}
                              onChange={(e) => {
                                const newEndDate = e.target.value
                                setBlockedDates(blockedDates.map(b =>
                                  group.blocks.some(gb => gb.id === b.id) ? { ...b, endDate: newEndDate } : b
                                ))
                              }}
                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              for (const block of group.blocks) {
                                await handleUpdate(block.id)
                              }
                              setEditing(null)
                            }}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity"
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
                            <p className="font-bold text-gray-900 text-lg">
                              {formatDateRange(group.startDate, group.endDate)}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {group.blocks.map((block) => (
                                <span
                                  key={block.id}
                                  className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"
                                >
                                  {block.property.name}
                                </span>
                              ))}
                            </div>
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
      </div>
    </div>
    </>
  )
}
