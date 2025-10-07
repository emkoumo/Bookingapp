'use client'

import { useState, useEffect } from 'react'
import { eachDayOfInterval, parseISO, format } from 'date-fns'
import DatePicker from './DatePicker'

interface Property {
  id: string
  name: string
}

interface Booking {
  id: string
  checkIn: string
  checkOut: string
  status: string
  property: {
    id: string
  }
}

interface BookingModalProps {
  properties: Property[]
  onClose: () => void
  onSave: (data: {
    propertyIds: string[]
    customerName: string
    contactInfo: string
    checkIn: string
    checkOut: string
    deposit: string
    notes: string
  }) => void
  onDelete?: () => void
  initialData?: {
    propertyIds: string[]
    customerName: string
    contactInfo: string
    checkIn: string
    checkOut: string
    deposit: string
    notes: string
  }
  isEdit?: boolean
  businessId?: string
  currentBookingId?: string // ID of booking being edited (to exclude from disabled dates)
}

export default function BookingModal({ properties, onClose, onSave, onDelete, initialData, isEdit = false, businessId, currentBookingId }: BookingModalProps) {
  const [formData, setFormData] = useState(initialData || {
    propertyIds: [] as string[],
    customerName: '',
    contactInfo: '',
    checkIn: '',
    checkOut: '',
    deposit: '',
    notes: '',
  })
  const [bookings, setBookings] = useState<Booking[]>([])
  const [disabledDates, setDisabledDates] = useState<string[]>([])

  // Fetch bookings to calculate disabled dates
  useEffect(() => {
    if (businessId && !isEdit) {
      fetchBookings()
    }
  }, [businessId, isEdit])

  // Calculate disabled dates when bookings or selected properties change
  useEffect(() => {
    if (!isEdit && formData.propertyIds.length > 0) {
      calculateDisabledDates()
    }
  }, [bookings, formData.propertyIds, isEdit])

  const fetchBookings = async () => {
    try {
      const res = await fetch(`/api/bookings?businessId=${businessId}`)
      const data = await res.json()
      setBookings(data)
    } catch (error) {
      console.error('Error fetching bookings:', error)
    }
  }

  const calculateDisabledDates = () => {
    const disabled: string[] = []

    // For each selected property, find all booked dates
    formData.propertyIds.forEach((propertyId) => {
      const propertyBookings = bookings.filter(
        (b) => b.property.id === propertyId &&
               b.id !== currentBookingId && // Exclude current booking in edit mode
               b.status === 'active' // Only consider active bookings
      )

      propertyBookings.forEach((booking) => {
        try {
          const start = parseISO(booking.checkIn)
          const end = parseISO(booking.checkOut)
          const dates = eachDayOfInterval({ start, end })
          dates.forEach((date) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            if (!disabled.includes(dateStr)) {
              disabled.push(dateStr)
            }
          })
        } catch (error) {
          console.error('Error parsing dates:', error)
        }
      })
    })

    setDisabledDates(disabled)
  }

  const handlePropertyToggle = (propertyId: string) => {
    setFormData((prev) => ({
      ...prev,
      propertyIds: prev.propertyIds.includes(propertyId)
        ? prev.propertyIds.filter((id) => id !== propertyId)
        : [...prev.propertyIds, propertyId],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.propertyIds.length === 0) {
      alert('Παρακαλώ επιλέξτε τουλάχιστον ένα κατάλυμα')
      return
    }
    if (!formData.customerName || !formData.checkIn || !formData.checkOut) {
      alert('Παρακαλώ συμπληρώστε τα υποχρεωτικά πεδία')
      return
    }
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 md:flex md:items-center md:justify-center z-[70] md:p-4">
      <div className="bg-white h-full md:h-auto md:rounded-2xl shadow-2xl md:max-w-2xl w-full md:my-8 animate-scale-in flex flex-col">
        {/* Header - Sticky on mobile */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 md:px-6 py-4 md:rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-bold text-white">{isEdit ? 'Επεξεργασία Κράτησης' : 'Νέα Κράτηση'}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:opacity-80 transition-opacity text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Form - Scrollable content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 space-y-4">
          {/* Property Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Κατάλυμα * {!isEdit && <span className="text-xs font-normal text-gray-500">(επιλέξτε ένα ή περισσότερα)</span>}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {properties.map((prop) => (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => !isEdit && handlePropertyToggle(prop.id)}
                  disabled={isEdit}
                  className={`px-4 py-3 rounded-lg font-medium text-sm transition-colors border-2 ${
                    formData.propertyIds.includes(prop.id)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  } ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {formData.propertyIds.includes(prop.id) && '✓ '}
                  {prop.name}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Όνομα Πελάτη *</label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              required
            />
          </div>

          {/* Contact Info */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Στοιχεία Επικοινωνίας</label>
            <input
              type="text"
              value={formData.contactInfo}
              onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
              placeholder="Τηλέφωνο, Email"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Dates */}
          <div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <label className="block text-sm font-bold text-gray-700">Check-in *</label>
              <label className="block text-sm font-bold text-gray-700">Check-out *</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DatePicker
                value={formData.checkIn}
                onChange={(date) => setFormData({ ...formData, checkIn: date })}
                placeholder="Ημερομηνία"
                disabledDates={disabledDates}
                isEditMode={isEdit}
                minDate={format(new Date(), 'yyyy-MM-dd')}
                maxDate={formData.checkOut || undefined}
                highlightDate={formData.checkOut || undefined}
              />
              <DatePicker
                value={formData.checkOut}
                onChange={(date) => setFormData({ ...formData, checkOut: date })}
                placeholder="Ημερομηνία"
                disabledDates={disabledDates}
                isEditMode={isEdit}
                minDate={formData.checkIn || format(new Date(), 'yyyy-MM-dd')}
                highlightDate={formData.checkIn || undefined}
              />
            </div>
          </div>

          {/* Deposit */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Προκαταβολή</label>
            <input
              type="text"
              value={formData.deposit}
              onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
              placeholder="π.χ. 100€"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Σημειώσεις</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          </div>
        </form>

        {/* Actions - Sticky footer on mobile */}
        <div className="bg-white border-t border-gray-200 px-4 md:px-6 py-4 md:rounded-b-2xl sticky bottom-0">
          {isEdit && onDelete ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onDelete}
                className="p-3 text-red-600 border-2 border-red-300 hover:bg-red-50 rounded-lg transition-colors"
                title="Διαγραφή"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <div className="w-px h-10 bg-gray-300"></div>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  handleSubmit(e as any)
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md"
              >
                Αποθήκευση
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
              >
                Ακύρωση
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  handleSubmit(e as any)
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md"
              >
                Αποθήκευση
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
