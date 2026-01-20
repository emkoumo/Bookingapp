'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import DatePicker from './DatePicker'

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
}

interface BlockedDateModalProps {
  properties: Property[]
  bookings: Booking[]
  blockedDates: BlockedDate[]
  onClose: () => void
  onSave: (data: {
    propertyIds: string[]
    startDate: string
    endDate: string
  }) => void
  onDelete?: () => void
  initialData?: BlockedDate
  businessId: string
}

export default function BlockedDateModal({
  properties,
  bookings,
  blockedDates,
  onClose,
  onSave,
  onDelete,
  initialData,
  businessId,
}: BlockedDateModalProps) {
  const isEdit = !!initialData

  const [formData, setFormData] = useState({
    propertyIds: isEdit && initialData ? [initialData.propertyId] : [] as string[],
    startDate: initialData?.startDate || '',
    endDate: initialData?.endDate || '',
  })

  const [disabledDates, setDisabledDates] = useState<string[]>([])
  const [dateConflicts, setDateConflicts] = useState<string[]>([])
  const [disabledCheckoutDates, setDisabledCheckoutDates] = useState<string[]>([])

  // Calculate disabled dates (existing bookings and other blocked dates)
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
          (b) => b.propertyId === propertyId && (!isEdit || b.id !== initialData.id)
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
  }, [formData.propertyIds, bookings, blockedDates, isEdit, initialData])

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

  // Real-time conflict detection
  useEffect(() => {
    if (!formData.startDate || !formData.endDate || formData.propertyIds.length === 0) {
      setDateConflicts([])
      return
    }

    const checkInDate = new Date(formData.startDate)
    const checkOutDate = new Date(formData.endDate)

    if (checkInDate >= checkOutDate) {
      setDateConflicts([])
      return
    }

    const conflicts: string[] = []

    formData.propertyIds.forEach((propertyId) => {
      const property = properties.find((p) => p.id === propertyId)
      if (!property) return

      // Check against active bookings
      const propertyBookings = bookings.filter(
        (b) => b.property.id === propertyId && b.status === 'active'
      )

      const hasConflict = propertyBookings.some((booking) => {
        const bookingStart = new Date(booking.checkIn)
        const bookingEnd = new Date(booking.checkOut)

        // Same-day turnover: check-in on someone's checkout date is OK
        const checkInDateOnly = format(checkInDate, 'yyyy-MM-dd')
        const bookingEndDateOnly = format(bookingEnd, 'yyyy-MM-dd')

        if (checkInDateOnly === bookingEndDateOnly) {
          return false
        }

        // Overlap logic
        return checkInDate < bookingEnd && checkOutDate > bookingStart
      })

      if (hasConflict) {
        conflicts.push(property.name)
      }
    })

    setDateConflicts(conflicts)
  }, [formData.startDate, formData.endDate, formData.propertyIds, bookings, properties])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.propertyIds.length === 0) {
      alert('Παρακαλώ επιλέξτε τουλάχιστον ένα κατάλυμα')
      return
    }

    if (!formData.startDate || !formData.endDate) {
      alert('Παρακαλώ επιλέξτε ημερομηνίες έναρξης και λήξης')
      return
    }

    if (dateConflicts.length > 0) {
      alert(`❌ Τα ακόλουθα καταλύματα έχουν ενεργές κρατήσεις:\n\n${dateConflicts.join('\n')}\n\nΠαρακαλώ επιλέξτε διαφορετικές ημερομηνίες.`)
      return
    }

    onSave(formData)
  }

  const handlePropertyToggle = (propertyId: string) => {
    setFormData((prev) => ({
      ...prev,
      propertyIds: prev.propertyIds.includes(propertyId)
        ? prev.propertyIds.filter((id) => id !== propertyId)
        : [...prev.propertyIds, propertyId],
    }))
  }

  const handleDelete = async () => {
    if (window.confirm('Σίγουρα θέλετε να διαγράψετε αυτό το μπλοκάρισμα;')) {
      onDelete?.()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 md:flex md:items-center md:justify-center z-[70] md:p-4 overflow-y-auto">
      <div className="bg-white h-full md:h-auto md:max-h-[90vh] md:rounded-2xl shadow-2xl md:max-w-2xl w-full md:my-8 animate-scale-in flex flex-col">
        {/* Header - Red theme */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 md:px-6 py-4 md:rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-bold text-white">
              {isEdit ? 'Επεξεργασία Μπλοκαρίσματος' : 'Μπλοκάρισμα Ημερομηνιών'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:opacity-80 transition-opacity text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-6 space-y-6">
          {/* Property Selection - Only show if not editing */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">
                Καταλύματα <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {properties.map((property) => (
                  <button
                    key={property.id}
                    type="button"
                    onClick={() => handlePropertyToggle(property.id)}
                    className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                      formData.propertyIds.includes(property.id)
                        ? 'bg-red-50 border-red-500 text-red-700'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-red-300'
                    }`}
                  >
                    {property.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start Date */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Ημερομηνία Έναρξης <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={formData.startDate}
              onChange={(dateStr) =>
                setFormData((prev) => ({
                  ...prev,
                  startDate: dateStr,
                  endDate: '', // Reset end date when start date changes
                }))
              }
              disabledDates={disabledDates}
              minDate={format(new Date(), 'yyyy-MM-dd')}
              placeholder="Επιλέξτε ημερομηνία"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Ημερομηνία Λήξης <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={formData.endDate}
              onChange={(dateStr) =>
                setFormData((prev) => ({
                  ...prev,
                  endDate: dateStr,
                }))
              }
              disabledDates={[...disabledDates, ...disabledCheckoutDates]}
              minDate={formData.startDate || format(new Date(), 'yyyy-MM-dd')}
              highlightDate={formData.startDate}
              initialMonth={formData.startDate}
              placeholder="Επιλέξτε ημερομηνία"
            />
          </div>

          {/* Conflict Warning */}
          {dateConflicts.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <span className="text-red-600 font-bold text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800 mb-1">
                    Σύγκρουση με Ενεργές Κρατήσεις
                  </p>
                  <p className="text-xs text-red-700">
                    Τα παρακάτω καταλύματα έχουν ενεργές κρατήσεις:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {dateConflicts.map((name) => (
                      <li key={name} className="text-xs font-medium text-red-800">
                        • {name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer - Sticky */}
        <div className="sticky bottom-0 bg-gray-50 px-4 md:px-6 py-4 border-t border-gray-200 flex justify-between md:rounded-b-2xl">
          <div>
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-white border-2 border-red-500 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors text-sm md:text-base"
              >
                Διαγραφή
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors text-sm md:text-base"
            >
              Ακύρωση
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={dateConflicts.length > 0 || !formData.startDate || !formData.endDate || formData.propertyIds.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base"
            >
              {isEdit ? 'Ενημέρωση' : 'Μπλοκάρισμα'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
