'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import Modal from '@/components/Modal'
import BookingModal from '@/components/BookingModal'
import BlockManagementModal from '@/components/BlockManagementModal'
import ScrollableCalendar from '@/components/ScrollableCalendar'
import DatePicker from '@/components/DatePicker'

interface Property {
  id: string
  name: string
}

interface Booking {
  id: string
  customerName: string
  contactInfo: string | null
  contactChannel?: '' | 'phone' | 'email' | 'viber' | 'messenger'
  checkIn: string
  checkOut: string
  deposit: string | null
  notes: string | null
  status: string
  totalPrice?: number
  advancePayment?: number
  remainingBalance?: number
  advancePaymentMethod?: string
  advancePaymentDate?: string
  extraBedEnabled?: boolean
  extraBedPricePerNight?: number
  extraBedTotal?: number
  property: Property
}

interface BlockedDate {
  id: string
  propertyId: string
  startDate: string
  endDate: string
  property: Property
}

function CalendarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get('business')

  const [bookings, setBookings] = useState<Booking[]>([])
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [modal, setModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)
  const [showBlockManagementModal, setShowBlockManagementModal] = useState(false)

  // Date range filter (optional - for narrowing the 12-month view)
  const [dateRangeStart, setDateRangeStart] = useState<string>('')
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('')

  useEffect(() => {
    if (businessId) {
      fetchData()
    }
  }, [businessId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [bookingsRes, propertiesRes, blockedDatesRes] = await Promise.all([
        fetch(`/api/bookings?businessId=${businessId}`),
        fetch(`/api/properties?businessId=${businessId}`),
        fetch(`/api/blocked-dates?businessId=${businessId}`),
      ])

      const bookingsData = await bookingsRes.json()
      const propertiesData = await propertiesRes.json()

      // Handle blocked dates API response - ensure it's an array
      let blockedDatesData = []
      if (blockedDatesRes.ok) {
        const data = await blockedDatesRes.json()
        blockedDatesData = Array.isArray(data) ? data : []
      }

      // Filter to show only next 12 months (rolling window)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const twelveMonthsLater = new Date(today)
      twelveMonthsLater.setMonth(twelveMonthsLater.getMonth() + 12)

      // Filter bookings: checkIn >= today AND checkIn < today + 12 months
      const filteredBookings = bookingsData.filter((booking: Booking) => {
        const checkIn = new Date(booking.checkIn)
        return checkIn >= today && checkIn < twelveMonthsLater
      })

      // Filter blocked dates: overlaps with next 12 months (startDate < today + 12 months AND endDate > today)
      const filteredBlockedDates = blockedDatesData.filter((blocked: BlockedDate) => {
        const startDate = new Date(blocked.startDate)
        const endDate = new Date(blocked.endDate)
        return startDate < twelveMonthsLater && endDate > today
      })

      setBookings(filteredBookings)
      setProperties(propertiesData)
      setBlockedDates(filteredBlockedDates)
    } catch (error) {
      console.error('Error fetching data:', error)
      setToast({ message: 'Σφάλμα κατά τη φόρτωση δεδομένων', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function getColorForProperty(propertyId: string) {
    const colors = [
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
    ]
    const index = properties.findIndex((p) => p.id === propertyId)
    return colors[index % colors.length]
  }

  const handleEventClick = (booking: Booking) => {
    console.log('Clicked booking:', booking)
    setEditingBooking(booking)
  }

  const handleSaveBooking = async (data: {
    propertyIds: string[]
    customerName: string
    contactInfo: string
    contactChannel?: '' | 'phone' | 'email' | 'viber' | 'messenger'
    checkIn: string
    checkOut: string
    deposit: string
    notes: string
    totalPrice?: number
    advancePayment?: number | null
    remainingBalance?: number | null
    advancePaymentMethod?: string | null
    advancePaymentDate?: string | null
    extraBedEnabled?: boolean
    extraBedPricePerNight?: number | null
    extraBedTotal?: number | null
    perPropertyPrices?: { [propertyId: string]: number }
  }) => {
    try {
      // Create a booking for each selected property
      const promises = data.propertyIds.map((propertyId) => {
        const individualPrice = data.perPropertyPrices && data.perPropertyPrices[propertyId]
          ? data.perPropertyPrices[propertyId]
          : data.totalPrice

        return fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId,
            customerName: data.customerName,
            contactInfo: data.contactInfo,
            contactChannel: data.contactChannel,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            deposit: data.deposit,
            notes: data.notes,
            totalPrice: individualPrice,
            advancePayment: data.advancePayment,
            remainingBalance: data.remainingBalance,
            advancePaymentMethod: data.advancePaymentMethod,
            advancePaymentDate: data.advancePaymentDate,
            extraBedEnabled: data.extraBedEnabled,
            extraBedPricePerNight: data.extraBedPricePerNight,
            extraBedTotal: data.extraBedTotal,
          }),
        })
      })

      const responses = await Promise.all(promises)
      const failed = responses.filter((res) => !res.ok)

      if (failed.length > 0) {
        const error = await failed[0].json()
        throw new Error(error.error || 'Αποτυχία αποθήκευσης')
      }

      setShowBookingModal(false)
      setToast({ message: `${data.propertyIds.length} κράτηση/εις δημιουργήθηκε/αν!`, type: 'success' })
      fetchData()
    } catch (error) {
      setToast({ message: (error as Error).message || 'Σφάλμα κατά την αποθήκευση', type: 'error' })
    }
  }

  const handleUpdateBooking = async (data: {
    propertyIds: string[]
    customerName: string
    contactInfo: string
    contactChannel?: '' | 'phone' | 'email' | 'viber' | 'messenger'
    checkIn: string
    checkOut: string
    deposit: string
    notes: string
    totalPrice?: number
    advancePayment?: number | null
    remainingBalance?: number | null
    advancePaymentMethod?: string | null
    advancePaymentDate?: string | null
    extraBedEnabled?: boolean
    extraBedPricePerNight?: number | null
    extraBedTotal?: number | null
  }) => {
    if (!editingBooking) return

    try {
      const res = await fetch(`/api/bookings/${editingBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: data.propertyIds[0],
          customerName: data.customerName,
          contactInfo: data.contactInfo,
          contactChannel: data.contactChannel,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          deposit: data.deposit,
          notes: data.notes,
          totalPrice: data.totalPrice,
          advancePayment: data.advancePayment,
          remainingBalance: data.remainingBalance,
          advancePaymentMethod: data.advancePaymentMethod,
          advancePaymentDate: data.advancePaymentDate,
          extraBedEnabled: data.extraBedEnabled,
          extraBedPricePerNight: data.extraBedPricePerNight,
          extraBedTotal: data.extraBedTotal,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Αποτυχία ενημέρωσης')
      }

      setEditingBooking(null)
      setToast({ message: 'Η κράτηση ενημερώθηκε!', type: 'success' })
      fetchData()
    } catch (error) {
      setToast({ message: (error as Error).message || 'Σφάλμα κατά την ενημέρωση', type: 'error' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      setToast({ message: 'Η κράτηση διαγράφηκε!', type: 'success' })
      fetchData()
    } catch (error) {
      console.error('Error deleting booking:', error)
      setToast({ message: 'Σφάλμα κατά τη διαγραφή', type: 'error' })
    }
  }

  const handleBlockedDateClick = (blockedDate: BlockedDate) => {
    console.log('Clicked blocked date:', blockedDate)
    setShowBlockManagementModal(true)
  }

  const setSeasonRange = () => {
    const currentYear = new Date().getFullYear()
    setDateRangeStart(`${currentYear}-04`)
    setDateRangeEnd(`${currentYear}-10`)
  }

  const clearDateRange = () => {
    setDateRangeStart('')
    setDateRangeEnd('')
  }

  // Generate month options for dropdowns (current year only)
  const generateMonthOptions = () => {
    const currentYear = new Date().getFullYear()
    const months = [
      'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
      'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
    ]
    const options: { value: string; label: string }[] = []

    // Add months for current year only
    months.forEach((month, index) => {
      const value = `${currentYear}-${String(index + 1).padStart(2, '0')}`
      options.push({ value, label: `${month}` })
    })

    return options
  }

  const monthOptions = generateMonthOptions()

  if (!businessId) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
              Δεν επιλέχθηκε επιχείρηση
            </h2>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Επιστροφή στην Αρχική
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {modal && (
        <Modal
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
          confirmText="Επεξεργασία"
          cancelText="Κλείσιμο"
          type="info"
        />
      )}
      {showBookingModal && (
        <BookingModal
          properties={properties}
          onClose={() => setShowBookingModal(false)}
          onSave={handleSaveBooking}
          businessId={businessId || ''}
        />
      )}
      {editingBooking && (
        <BookingModal
          properties={properties}
          onClose={() => setEditingBooking(null)}
          onSave={handleUpdateBooking}
          onDelete={() => {
            setEditingBooking(null)
            handleDelete(editingBooking.id)
          }}
          initialData={{
            propertyIds: [editingBooking.property.id],
            customerName: editingBooking.customerName,
            contactInfo: editingBooking.contactInfo || '',
            contactChannel: editingBooking.contactChannel || '',
            checkIn: editingBooking.checkIn.split('T')[0],
            checkOut: editingBooking.checkOut.split('T')[0],
            deposit: editingBooking.deposit || '',
            notes: editingBooking.notes || '',
            totalPrice: editingBooking.totalPrice,
            advancePayment: editingBooking.advancePayment,
            remainingBalance: editingBooking.remainingBalance,
            advancePaymentMethod: editingBooking.advancePaymentMethod,
            advancePaymentDate: editingBooking.advancePaymentDate,
            extraBedEnabled: editingBooking.extraBedEnabled,
            extraBedPricePerNight: editingBooking.extraBedPricePerNight,
            extraBedTotal: editingBooking.extraBedTotal,
          }}
          isEdit={true}
          businessId={businessId || ''}
          currentBookingId={editingBooking.id}
        />
      )}
      {showBlockManagementModal && (
        <BlockManagementModal
          properties={properties}
          bookings={bookings}
          businessId={businessId || ''}
          onClose={() => setShowBlockManagementModal(false)}
          onUpdate={fetchData}
        />
      )}
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto">
          <div className="bg-white md:m-4 md:rounded-xl md:shadow-lg pb-4">
            {/* Header Section */}
            <div className="py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between px-4">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center justify-center w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden md:inline ml-1 text-sm font-medium">Αρχική</span>
                </button>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 absolute left-1/2 transform -translate-x-1/2">
                  Ημερολόγιο
                </h1>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="px-2.5 py-2 md:px-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                  >
                    + Νέα
                  </button>
                  <button
                    onClick={() => setShowBlockManagementModal(true)}
                    className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    title="Μπλοκάρισμα Ημερομηνιών"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Property Tabs Section */}
            <div className="py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
                <button
                  onClick={() => setSelectedProperty('all')}
                  className={`px-2.5 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors ${
                    selectedProperty === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Όλα
                </button>
                {properties.map((prop) => (
                  <button
                    key={prop.id}
                    onClick={() => setSelectedProperty(prop.id)}
                    className={`px-2.5 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors ${
                      selectedProperty === prop.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {prop.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range Filter Section */}
            <div className="py-3 border-b border-gray-200 flex-shrink-0">
              <div className="px-4 space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <select
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                      className="appearance-none px-2.5 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors bg-white cursor-pointer"
                    >
                      <option value="">Από μήνα</option>
                      {monthOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <span className="text-gray-500">-</span>
                  <div className="relative">
                    <select
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                      className="appearance-none px-2.5 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm hover:border-gray-400 transition-colors bg-white cursor-pointer"
                    >
                      <option value="">Έως μήνα</option>
                      {monthOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {(dateRangeStart || dateRangeEnd) && (
                    <button
                      onClick={clearDateRange}
                      className="px-2.5 py-2 border-2 border-gray-300 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 hover:border-gray-400 text-sm font-semibold transition-colors flex items-center gap-1"
                      title="Καθαρισμός"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="hidden md:inline">Καθαρισμός</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Calendar Section */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-lg text-gray-600 font-medium">Φόρτωση...</div>
              </div>
            ) : (
              <ScrollableCalendar
                bookings={bookings}
                blockedDates={blockedDates}
                properties={properties}
                selectedProperty={selectedProperty}
                onBookingClick={handleEventClick}
                onBlockedDateClick={handleBlockedDateClick}
                getColorForProperty={getColorForProperty}
                dateRangeStart={dateRangeStart}
                dateRangeEnd={dateRangeEnd}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl">Φόρτωση...</div>
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  )
}
