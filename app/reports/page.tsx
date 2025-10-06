'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { el } from 'date-fns/locale'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import DatePicker from '@/components/DatePicker'

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
  status: string
  property: {
    id: string
    name: string
  }
}

function ReportsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get('business')

  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('all')
  const [filterMode, setFilterMode] = useState<'next10days' | 'custom'>('next10days')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)

  useEffect(() => {
    if (businessId) {
      fetchBookings()
    }
  }, [businessId])

  const fetchBookings = async () => {
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
    // Only show active bookings
    if (booking.status !== 'active') return false

    // Filter by property
    if (selectedProperty !== 'all' && booking.property.id !== selectedProperty) {
      return false
    }

    // Filter by date range (check-in date only)
    const checkIn = parseISO(booking.checkIn)
    const start = parseISO(startDate)
    const end = parseISO(endDate)

    return isWithinInterval(checkIn, { start, end })
  })

  // Group bookings by check-in date
  const groupedBookings = filteredBookings.reduce((groups, booking) => {
    const date = format(parseISO(booking.checkIn), 'yyyy-MM-dd')
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(booking)
    return groups
  }, {} as Record<string, Booking[]>)

  const sortedDates = Object.keys(groupedBookings).sort()

  const handleNext10Days = () => {
    setFilterMode('next10days')
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setEndDate(format(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  }

  const exportCSV = () => {
    const headers = ['Όνομα', 'Κατάλυμα', 'Check-in', 'Check-out', 'Επαφή', 'Προκαταβολή', 'Κατάσταση']
    const rows = filteredBookings.map((b) => [
      b.customerName,
      b.property.name,
      format(new Date(b.checkIn), 'dd/MM/yyyy'),
      format(new Date(b.checkOut), 'dd/MM/yyyy'),
      b.contactInfo || '',
      b.deposit || '',
      b.status,
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `bookings-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
  }

  const exportPDF = () => {
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text('Αναφορά Κρατήσεων', 14, 22)

    doc.setFontSize(11)
    doc.text(`Περίοδος: ${format(new Date(startDate), 'dd/MM/yyyy')} - ${format(new Date(endDate), 'dd/MM/yyyy')}`, 14, 30)

    const tableData = filteredBookings.map((b) => [
      b.customerName,
      b.property.name,
      format(new Date(b.checkIn), 'dd/MM/yyyy'),
      format(new Date(b.checkOut), 'dd/MM/yyyy'),
      b.contactInfo || '',
      b.deposit || '',
      b.status,
    ])

    autoTable(doc, {
      head: [['Όνομα', 'Κατάλυμα', 'Check-in', 'Check-out', 'Επαφή', 'Προκαταβολή', 'Κατάσταση']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`bookings-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
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
                  Αναφορές
                </h1>
                <button
                  onClick={exportPDF}
                  className="px-2.5 py-2 md:px-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  PDF
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

            {/* Filter Mode Buttons - Single Row */}
            <div className="py-3 border-b border-gray-200 px-4">
              <div className="flex gap-2">
                <button
                  onClick={handleNext10Days}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    filterMode === 'next10days'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Επόμενες 10 Ημέρες
                </button>
                <button
                  onClick={() => setFilterMode('custom')}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    filterMode === 'custom'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Επιλογή Περιόδου
                </button>
              </div>
            </div>

            {/* Date Range Inputs - Show only when custom mode */}
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

            {/* Check-ins Count */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="bg-blue-50 p-4 rounded-lg text-center max-w-xs mx-auto">
                <div className="text-3xl md:text-4xl font-bold text-blue-600">{filteredBookings.length}</div>
                <div className="text-sm md:text-base text-gray-700 font-medium">Αναμενόμενα Check-ins</div>
              </div>
            </div>

            {/* Bookings Content */}
            <div className="px-4 py-3">
              {loading ? (
                <div className="text-center py-8 text-gray-600">Φόρτωση...</div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Δεν βρέθηκαν κρατήσεις</div>
              ) : (
                <>
                  {/* Mobile View - Cards grouped by date */}
                  <div className="md:hidden space-y-4">
                    {sortedDates.map((date) => (
                      <div key={date} className="space-y-2">
                        {/* Date Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-2 rounded-lg font-bold text-sm">
                          {format(parseISO(date), 'EEEE, dd MMMM yyyy', { locale: el })}
                          <span className="ml-2 bg-white text-indigo-600 px-2 py-0.5 rounded-full text-xs">
                            {groupedBookings[date].length}
                          </span>
                        </div>
                        {/* Bookings for this date */}
                        {groupedBookings[date].map((booking) => (
                          <div key={booking.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-bold text-base text-gray-900">{booking.customerName}</h3>
                              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                {booking.property.name}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span className="font-medium">Check-out:</span>
                                <span>{format(parseISO(booking.checkOut), 'd MMM yyyy', { locale: el })}</span>
                              </div>
                              {booking.contactInfo && (
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span>{booking.contactInfo}</span>
                                </div>
                              )}
                              {booking.deposit && (
                                <div className="flex items-center gap-2 text-green-600 font-medium">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Προκαταβολή: {booking.deposit}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
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
                          <th className="p-3 text-left">Προκαταβολή</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDates.map((date) => (
                          groupedBookings[date].map((booking, index) => (
                            <tr key={booking.id} className={`border-b hover:bg-gray-50 ${index === 0 ? 'border-t-2 border-t-blue-600' : ''}`}>
                              {index === 0 && (
                                <td className="p-3 font-bold text-blue-600 bg-blue-50" rowSpan={groupedBookings[date].length}>
                                  {format(parseISO(date), 'd MMM yyyy', { locale: el })}
                                </td>
                              )}
                              <td className="p-3 font-semibold">{booking.customerName}</td>
                              <td className="p-3">{booking.property.name}</td>
                              <td className="p-3">{format(parseISO(booking.checkOut), 'd MMM yyyy', { locale: el })}</td>
                              <td className="p-3">{booking.contactInfo || '-'}</td>
                              <td className="p-3 text-green-600 font-medium">{booking.deposit || '-'}</td>
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

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-xl">Φόρτωση...</div></div>}>
      <ReportsContent />
    </Suspense>
  )
}
