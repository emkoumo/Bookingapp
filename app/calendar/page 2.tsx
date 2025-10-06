'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { format } from 'date-fns'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import Modal from '@/components/Modal'
import BookingModal from '@/components/BookingModal'

interface Property {
  id: string
  name: string
}

interface Booking {
  id: string
  customerName: string
  checkIn: string
  checkOut: string
  property: Property
  status: string
}

function CalendarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get('business')

  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [modal, setModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const [showBookingModal, setShowBookingModal] = useState(false)

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

  const filteredBookings = bookings.filter((booking) => {
    if (selectedProperty === 'all') return true
    return booking.property.id === selectedProperty
  })

  const events = filteredBookings
    .filter((b) => b.status === 'active')
    .map((booking) => {
      // Format property name to short version (e.g., "Apartment 1" -> "Apt.1")
      const shortName = booking.property.name
        .replace('Apartment', 'Apt.')
        .replace('Villa', 'V.')
        .replace(/\s+/g, '')

      // FullCalendar end date is exclusive, so we add 1 day to include checkout day
      const checkOutDate = new Date(booking.checkOut)
      checkOutDate.setDate(checkOutDate.getDate() + 1)

      return {
        id: booking.id,
        title: shortName,
        start: booking.checkIn,
        end: checkOutDate.toISOString().split('T')[0],
        allDay: true,
        backgroundColor: getColorForProperty(booking.property.id),
        borderColor: getColorForProperty(booking.property.id),
        extendedProps: {
          propertyName: booking.property.name,
          customerName: booking.customerName,
        },
      }
    })

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

  const handleEventClick = (info: any) => {
    const booking = bookings.find((b) => b.id === info.event.id)
    if (booking) {
      const message = `Κράτηση: ${booking.customerName}\nΚατάλυμα: ${
        booking.property.name
      }\nCheck-in: ${format(new Date(booking.checkIn), 'dd/MM/yyyy')}\nCheck-out: ${format(
        new Date(booking.checkOut),
        'dd/MM/yyyy'
      )}\n\nΘέλετε να επεξεργαστείτε αυτή την κράτηση;`

      setModal({
        title: 'Λεπτομέρειες Κράτησης',
        message,
        onConfirm: () => {
          router.push(`/bookings?business=${businessId}&edit=${booking.id}`)
          setModal(null)
        },
      })
    }
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
      setToast({ message: `${data.propertyIds.length} κράτηση/εις δημιουργήθηκε/αν!`, type: 'success' })
      fetchData()
    } catch (error) {
      setToast({ message: (error as Error).message || 'Σφάλμα κατά την αποθήκευση', type: 'error' })
    }
  }

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
                  Ημερολόγιο
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

            {/* Calendar Section */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="text-lg text-gray-600 font-medium">Φόρτωση...</div>
              </div>
            ) : (
              <div className="py-3 calendar-wrapper">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: 'prev,next',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek',
                  }}
                  events={events}
                  eventClick={handleEventClick}
                  height="auto"
                  locale="el"
                  firstDay={1}
                  buttonText={{
                    month: 'Μήνας',
                    week: 'Εβδομάδα',
                  }}
                  titleFormat={{ year: 'numeric', month: 'short' }}
                  eventTextColor="#ffffff"
                  eventDisplay="block"
                  dayMaxEvents={false}
                />
              </div>
            )}

            {/* Legend Section */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
              <h3 className="font-bold text-gray-900 mb-3 text-sm">Καταλύματα</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {properties.map((prop) => (
                  <div key={prop.id} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ backgroundColor: getColorForProperty(prop.id) }}
                    />
                    <span className="text-sm text-gray-900 font-medium truncate">{prop.name}</span>
                  </div>
                ))}
              </div>
            </div>
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
