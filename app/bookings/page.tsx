'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO, isWithinInterval } from 'date-fns'
import { el } from 'date-fns/locale'
import Toast from '@/components/Toast'
import Alert from '@/components/Alert'
import Modal from '@/components/Modal'
import BookingModal from '@/components/BookingModal'
import DatePicker from '@/components/DatePicker'
import Header from '@/components/Header'

interface Property {
  id: string
  name: string
}

interface Booking {
  id: string
  customerName: string
  contactInfo: string | null
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
  property: {
    id: string
    name: string
  }
}

function BookingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get('business')

  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [filterMode, setFilterMode] = useState<'all' | 'next10days' | 'custom'>('all')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [alert, setAlert] = useState<{ title?: string; message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [modal, setModal] = useState<{ title: string; message: string; onConfirm: () => void; type?: 'danger' | 'warning' | 'info' } | null>(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)

  useEffect(() => {
    if (businessId) {
      fetchData()
    }
  }, [businessId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [bookingsRes, propertiesRes] = await Promise.all([
        fetch(`/api/bookings?businessId=${businessId}`),
        fetch(`/api/properties?businessId=${businessId}`),
      ])

      const bookingsData = await bookingsRes.json()
      const propertiesData = await propertiesRes.json()

      setBookings(bookingsData)
      setProperties(propertiesData)
    } catch (error) {
      console.error('Error fetching data:', error)
      setToast({ message: 'Σφάλμα κατά τη φόρτωση δεδομένων', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Apply all filters - only show active bookings
  const filteredBookings = bookings.filter((booking) => {
    // Only show active bookings
    if (booking.status !== 'active') {
      return false
    }

    // Filter by property
    if (selectedProperty !== 'all' && booking.property.id !== selectedProperty) {
      return false
    }

    // Filter by date range (check-in date only)
    if (filterMode !== 'all') {
      const checkIn = parseISO(booking.checkIn)
      const start = parseISO(startDate)
      const end = parseISO(endDate)

      if (!isWithinInterval(checkIn, { start, end })) {
        return false
      }
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        booking.customerName.toLowerCase().includes(searchLower) ||
        booking.property.name.toLowerCase().includes(searchLower) ||
        booking.contactInfo?.toLowerCase().includes(searchLower)
      )
    }

    return true
  })

  // Sort by check-in date (earliest first)
  const sortedBookings = [...filteredBookings].sort(
    (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
  )

  // Group bookings by check-in date
  const groupedBookings = sortedBookings.reduce((groups, booking) => {
    const date = format(parseISO(booking.checkIn), 'yyyy-MM-dd')
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(booking)
    return groups
  }, {} as Record<string, Booking[]>)

  const sortedDates = Object.keys(groupedBookings).sort()

  // Calculate financial totals
  const financialSummary = filteredBookings.reduce((acc, booking) => {
    return {
      totalRevenue: acc.totalRevenue + (booking.totalPrice ? Number(booking.totalPrice) : 0),
      totalAdvances: acc.totalAdvances + (booking.advancePayment ? Number(booking.advancePayment) : 0),
      totalRemaining: acc.totalRemaining + (booking.remainingBalance ? Number(booking.remainingBalance) : 0)
    }
  }, { totalRevenue: 0, totalAdvances: 0, totalRemaining: 0 })

  const handleShowAll = () => {
    setFilterMode('all')
  }

  const handleNext10Days = () => {
    setFilterMode('next10days')
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setEndDate(format(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  }

  const handleDelete = async (id: string) => {
    setModal({
      title: 'Επιβεβαίωση Ακύρωσης',
      message: 'Είστε σίγουροι ότι θέλετε να ακυρώσετε αυτή την κράτηση;',
      type: 'danger',
      onConfirm: async () => {
        setModal(null)
        try {
          const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete')

          setToast({ message: 'Η κράτηση ακυρώθηκε!', type: 'success' })
          fetchData()
        } catch (error) {
          console.error('Error deleting booking:', error)
          setToast({ message: 'Σφάλμα κατά την ακύρωση', type: 'error' })
        }
      },
    })
  }

  const handleSaveBooking = async (data: {
    propertyIds: string[]
    customerName: string
    contactInfo: string
    checkIn: string
    checkOut: string
    deposit: string
    notes: string
    totalPrice?: number
    advancePayment?: number | null
    remainingBalance?: number | null
    advancePaymentMethod?: string | null
    advancePaymentDate?: string | null
    perPropertyPrices?: { [propertyId: string]: number }
  }) => {
    try {
      const promises = data.propertyIds.map((propertyId) => {
        const individualPrice = data.perPropertyPrices && data.perPropertyPrices[propertyId]
          ? data.perPropertyPrices[propertyId]
          : data.totalPrice

        let individualAdvance = data.advancePayment
        let individualRemaining = data.remainingBalance

        if (data.propertyIds.length > 1 && data.perPropertyPrices && data.advancePayment) {
          const totalAllProperties = data.totalPrice || 0
          const proportion = individualPrice ? individualPrice / totalAllProperties : 0
          individualAdvance = Math.round(data.advancePayment * proportion * 100) / 100
          individualRemaining = individualPrice ? individualPrice - individualAdvance : 0
        }

        return fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId,
            customerName: data.customerName,
            contactInfo: data.contactInfo,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            deposit: data.deposit,
            notes: data.notes,
            totalPrice: individualPrice,
            advancePayment: individualAdvance,
            remainingBalance: individualRemaining,
            advancePaymentMethod: data.advancePaymentMethod,
            advancePaymentDate: data.advancePaymentDate,
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
      setAlert({
        title: 'Επιτυχία!',
        message: `${data.propertyIds.length} κράτηση/εις δημιουργήθηκε/αν!`,
        type: 'success',
      })
      fetchData()
    } catch (error) {
      setAlert({
        title: 'Σφάλμα',
        message: (error as Error).message || 'Σφάλμα κατά την αποθήκευση',
        type: 'error',
      })
    }
  }

  const handleUpdateBooking = async (data: {
    propertyIds: string[]
    customerName: string
    contactInfo: string
    checkIn: string
    checkOut: string
    deposit: string
    notes: string
    totalPrice?: number
    advancePayment?: number | null
    remainingBalance?: number | null
    advancePaymentMethod?: string | null
    advancePaymentDate?: string | null
    perPropertyPrices?: { [propertyId: string]: number }
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
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          deposit: data.deposit,
          notes: data.notes,
          totalPrice: data.totalPrice,
          advancePayment: data.advancePayment,
          remainingBalance: data.remainingBalance,
          advancePaymentMethod: data.advancePaymentMethod,
          advancePaymentDate: data.advancePaymentDate,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Αποτυχία ενημέρωσης')
      }

      setEditingBooking(null)
      setAlert({
        title: 'Επιτυχία!',
        message: 'Η κράτηση ενημερώθηκε!',
        type: 'success',
      })
      fetchData()
    } catch (error) {
      setAlert({
        title: 'Σφάλμα',
        message: (error as Error).message || 'Σφάλμα κατά την ενημέρωση',
        type: 'error',
      })
    }
  }

  if (!businessId) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Δεν επιλέχθηκε επιχείρηση</h2>
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
      {alert && (
        <Alert
          title={alert.title}
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert(null)}
        />
      )}
      {modal && (
        <Modal
          title={modal.title}
          message={modal.message}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal(null)}
          confirmText={modal.type === 'danger' ? 'Ακύρωση Κράτησης' : 'Επιβεβαίωση'}
          cancelText="Άκυρο"
          type={modal.type}
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
            checkIn: editingBooking.checkIn.split('T')[0],
            checkOut: editingBooking.checkOut.split('T')[0],
            deposit: editingBooking.deposit || '',
            notes: editingBooking.notes || '',
            totalPrice: editingBooking.totalPrice,
            advancePayment: editingBooking.advancePayment,
            remainingBalance: editingBooking.remainingBalance,
            advancePaymentMethod: editingBooking.advancePaymentMethod,
            advancePaymentDate: editingBooking.advancePaymentDate ? editingBooking.advancePaymentDate.split('T')[0] : '',
          }}
          isEdit={true}
          businessId={businessId || ''}
          currentBookingId={editingBooking.id}
        />
      )}
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white md:m-4 md:rounded-xl md:shadow-lg">
            {/* Header Section */}
            <div className="py-3 border-b border-gray-200">
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
                  Κρατήσεις
                </h1>
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="px-2.5 py-2 md:px-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  + Νέα
                </button>
              </div>
            </div>

            {/* Property Tabs Section */}
            <div className="py-3 border-b border-gray-200">
              <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide">
                <button
                  onClick={() => setSelectedProperty('all')}
                  className={`px-3 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                    selectedProperty === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>Όλα</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    selectedProperty === 'all'
                      ? 'bg-white text-blue-600'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {bookings.filter(b => b.status === 'active').length}
                  </span>
                </button>
                {properties.map((prop) => {
                  const propBookingCount = bookings.filter(b =>
                    b.property.id === prop.id && b.status === 'active'
                  ).length
                  return (
                    <button
                      key={prop.id}
                      onClick={() => setSelectedProperty(prop.id)}
                      className={`px-3 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                        selectedProperty === prop.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>{prop.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        selectedProperty === prop.id
                          ? 'bg-white text-blue-600'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {propBookingCount}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date Filter Mode Buttons */}
            <div className="py-3 border-b border-gray-200 px-4">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleShowAll}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${
                    filterMode === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Όλα
                </button>
                <button
                  onClick={handleNext10Days}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${
                    filterMode === 'next10days'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Επόμενες 10
                </button>
                <button
                  onClick={() => setFilterMode('custom')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap ${
                    filterMode === 'custom'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Περίοδος
                </button>
              </div>
            </div>

            {/* Custom Date Range Inputs */}
            {filterMode === 'custom' && (
              <div className="py-3 border-b border-gray-200 px-4">
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <label className="block text-xs font-semibold text-gray-700">Από</label>
                  <label className="block text-xs font-semibold text-gray-700">Έως</label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Ημερομηνία"
                  />
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="Ημερομηνία"
                  />
                </div>
              </div>
            )}

            {/* Search Section */}
            <div className="py-3 border-b border-gray-200 px-4">
              <input
                type="text"
                placeholder="Αναζήτηση (όνομα, κατάλυμα, επαφή)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>

            {/* Bookings Count */}
            {filteredBookings.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-200">
                <div className="text-center">
                  <span className="text-sm text-gray-600">Σύνολο: </span>
                  <span className="text-sm font-bold text-blue-600">{filteredBookings.length} κρατήσεις</span>
                </div>
              </div>
            )}

            {/* Bookings Content */}
            <div className="px-4 py-3">
              {loading ? (
                <div className="text-center py-8 text-gray-600">Φόρτωση...</div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Δεν βρέθηκαν κρατήσεις</div>
              ) : (
                <>
                  {/* Mobile View - Cards grouped by date */}
                  <div className="md:hidden space-y-6">
                    {sortedDates.map((date, dateIndex) => (
                      <div key={date}>
                        {dateIndex > 0 && <div className="border-t border-gray-300 my-4"></div>}
                        <div className="space-y-3">
                        {/* Date Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-xl font-bold text-base shadow-lg border-2 border-indigo-700">
                          <div className="flex items-center justify-between">
                            <span>{format(parseISO(date), 'EEEE, dd MMMM yyyy', { locale: el })}</span>
                            <span className="bg-white text-indigo-600 px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                              {groupedBookings[date].length}
                            </span>
                          </div>
                        </div>
                        {/* Bookings for this date */}
                        {groupedBookings[date].map((booking) => (
                          <div key={booking.id} className="bg-white border-2 border-gray-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            {/* Header with Customer Name, Property, and Actions */}
                            <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-3 border-b border-gray-200">
                              <div className="flex items-start justify-between mb-2">
                                <h3 className="font-bold text-lg text-gray-900 flex-1">{booking.customerName}</h3>
                                <div className="flex gap-1 ml-2">
                                  <button
                                    onClick={() => setEditingBooking(booking)}
                                    className="p-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
                                    title="Επεξεργασία"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(booking.id)}
                                    className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-gray-300"
                                    title="Ακύρωση"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-600 text-white">
                                {booking.property.name}
                              </span>
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-3">
                              {/* Check-in and Check-out Dates */}
                              <div className="flex items-center justify-between gap-2 text-sm">
                                {/* Check-in */}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 flex-shrink-0">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 font-medium">Check-in</div>
                                    <div className="font-semibold text-gray-900 whitespace-nowrap">{format(parseISO(booking.checkIn), 'd MMM yyyy', { locale: el })}</div>
                                  </div>
                                </div>

                                {/* Check-out */}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 flex-shrink-0">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 font-medium">Check-out</div>
                                    <div className="font-semibold text-gray-900 whitespace-nowrap">{format(parseISO(booking.checkOut), 'd MMM yyyy', { locale: el })}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Contact Info */}
                              {booking.contactInfo && (
                                <div className="flex items-center gap-3 text-sm">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 font-medium">Επαφή</div>
                                    <div className="font-semibold text-gray-900">{booking.contactInfo}</div>
                                  </div>
                                </div>
                              )}

                              {/* Financial info */}
                              {booking.totalPrice && (
                                <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-3 space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-gray-700">Σύνολο</span>
                                    <span className="text-base font-bold text-blue-600">€{Number(booking.totalPrice).toFixed(2)}</span>
                                  </div>
                                  {booking.advancePayment && booking.advancePayment > 0 && (
                                    <>
                                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                        <span className="text-sm font-bold text-gray-700">Προκαταβολή</span>
                                        <span className="text-base font-bold text-green-600">€{Number(booking.advancePayment).toFixed(2)}</span>
                                      </div>
                                      {booking.advancePaymentMethod && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          <span className="px-2 py-0.5 bg-gray-200 rounded font-medium">{booking.advancePaymentMethod}</span>
                                          {booking.advancePaymentDate && (
                                            <span>{format(parseISO(booking.advancePaymentDate), 'd MMM yyyy', { locale: el })}</span>
                                          )}
                                        </div>
                                      )}
                                      {booking.remainingBalance && booking.remainingBalance > 0 && (
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                          <span className="text-sm font-bold text-gray-700">Υπόλοιπο</span>
                                          <span className="text-base font-bold text-amber-600">€{Number(booking.remainingBalance).toFixed(2)}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Legacy deposit field */}
                              {!booking.totalPrice && booking.deposit && (
                                <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2 text-sm text-gray-600">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Προκαταβολή: {booking.deposit}</span>
                                </div>
                              )}

                              {/* Notes */}
                              {booking.notes && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                  <div className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    <p className="text-xs text-gray-700 italic leading-relaxed">{booking.notes}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop View - Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="p-3 text-left">Check-in</th>
                          <th className="p-3 text-left">Όνομα</th>
                          <th className="p-3 text-left">Κατάλυμα</th>
                          <th className="p-3 text-left">Check-out</th>
                          <th className="p-3 text-left">Επαφή</th>
                          <th className="p-3 text-right">Σύνολο</th>
                          <th className="p-3 text-right">Προκατ/λή</th>
                          <th className="p-3 text-left">Τρόπος</th>
                          <th className="p-3 text-right">Υπόλοιπο</th>
                          <th className="p-3 text-center">Ενέργειες</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDates.map((date) => (
                          groupedBookings[date].map((booking, index) => (
                            <tr key={booking.id} className={`border-b hover:bg-gray-50 ${
                              index === 0 ? 'border-t-2 border-t-blue-600' : ''
                            }`}>
                              {index === 0 && (
                                <td className="p-3 font-bold text-blue-600 bg-blue-50" rowSpan={groupedBookings[date].length}>
                                  {format(parseISO(date), 'd MMM yyyy', { locale: el })}
                                </td>
                              )}
                              <td className="p-3 font-semibold">{booking.customerName}</td>
                              <td className="p-3">{booking.property.name}</td>
                              <td className="p-3">{format(parseISO(booking.checkOut), 'd MMM yyyy', { locale: el })}</td>
                              <td className="p-3">{booking.contactInfo || '-'}</td>
                              <td className="p-3 text-right font-bold text-blue-600">
                                {booking.totalPrice ? `€${Number(booking.totalPrice).toFixed(2)}` : (booking.deposit || '-')}
                              </td>
                              <td className="p-3 text-right font-semibold text-green-600">
                                {booking.advancePayment ? `€${Number(booking.advancePayment).toFixed(2)}` : '-'}
                              </td>
                              <td className="p-3 text-xs">
                                {booking.advancePaymentMethod || '-'}
                                {booking.advancePaymentDate && (
                                  <div className="text-gray-500">
                                    {format(parseISO(booking.advancePaymentDate), 'd/MM', { locale: el })}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-right font-semibold text-amber-600">
                                {booking.remainingBalance ? `€${Number(booking.remainingBalance).toFixed(2)}` : '-'}
                              </td>
                              <td className="p-3">
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={() => setEditingBooking(booking)}
                                    className="p-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
                                    title="Επεξεργασία"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(booking.id)}
                                    className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-gray-300"
                                    title="Ακύρωση"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl">Φόρτωση...</div>
        </div>
      }
    >
      <BookingsContent />
    </Suspense>
  )
}
