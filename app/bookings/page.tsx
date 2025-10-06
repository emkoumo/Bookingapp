'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'
import Toast from '@/components/Toast'
import Alert from '@/components/Alert'
import Modal from '@/components/Modal'
import BookingModal from '@/components/BookingModal'
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
  property: {
    id: string
    name: string
  }
}

function BookingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get('business')
  const editId = searchParams.get('edit')

  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
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


  useEffect(() => {
    filterBookings()
  }, [bookings, searchTerm, selectedProperty])

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

  const filterBookings = () => {
    let filtered = [...bookings]

    // Filter by property
    if (selectedProperty !== 'all') {
      filtered = filtered.filter((b) => b.property.id === selectedProperty)
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (b) =>
          b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.contactInfo?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Only show active bookings
    filtered = filtered.filter((b) => b.status === 'active')

    setFilteredBookings(filtered)
  }


  const handleDelete = async (id: string) => {
    setModal({
      title: 'Επιβεβαίωση Διαγραφής',
      message: 'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την κράτηση;',
      type: 'danger',
      onConfirm: async () => {
        setModal(null)
        try {
          const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Failed to delete')

          setToast({ message: 'Η κράτηση διαγράφηκε!', type: 'success' })
          fetchData()
        } catch (error) {
          console.error('Error deleting booking:', error)
          setToast({ message: 'Σφάλμα κατά τη διαγραφή', type: 'error' })
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
  }) => {
    try {
      // Create a booking for each selected property
      const promises = data.propertyIds.map((propertyId) =>
        fetch('/api/bookings', {
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
          }),
        })
      )

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
  }) => {
    if (!editingBooking) return

    try {
      const res = await fetch(`/api/bookings/${editingBooking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: data.propertyIds[0], // Use first selected property for edit
          customerName: data.customerName,
          contactInfo: data.contactInfo,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          deposit: data.deposit,
          notes: data.notes,
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
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
          confirmText={modal.type === 'danger' ? 'Διαγραφή' : 'Επιβεβαίωση'}
          cancelText="Ακύρωση"
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

            {/* Bookings List Section */}
            <div className="px-4 py-3">
              {loading ? (
                <div className="text-center py-8 text-gray-600">Φόρτωση...</div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Δεν βρέθηκαν κρατήσεις
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow relative"
                    >
                      {/* Action buttons - top right */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button
                          onClick={() => setEditingBooking(booking)}
                          className="p-2 text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                          title="Επεξεργασία"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(booking.id)}
                          className="p-2 text-red-600 border border-red-300 hover:bg-red-50 rounded-lg transition-colors"
                          title="Διαγραφή"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* Content */}
                      <div className="pr-20">
                        <h3 className="font-semibold text-lg text-gray-800">
                          {booking.customerName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {booking.property.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {format(new Date(booking.checkIn), 'd MMM yyyy', { locale: el })} →{' '}
                          {format(new Date(booking.checkOut), 'd MMM yyyy', { locale: el })}
                        </p>
                        {booking.contactInfo && (
                          <p className="text-sm text-gray-600">
                            📞 {booking.contactInfo}
                          </p>
                        )}
                        {booking.deposit && (
                          <p className="text-sm text-gray-600">
                            💰 {booking.deposit}
                          </p>
                        )}
                        {booking.notes && (
                          <p className="text-sm text-gray-500 mt-2">
                            {booking.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
