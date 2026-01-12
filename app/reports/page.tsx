'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { el } from 'date-fns/locale'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
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
  contactChannel?: '' | 'phone' | 'email' | 'viber' | 'messenger'
  checkIn: string
  checkOut: string
  deposit: string | null
  status: string
  totalPrice?: number
  advancePayment?: number
  remainingBalance?: number
  advancePaymentMethod?: string
  advancePaymentDate?: string
  extraBedEnabled?: boolean
  extraBedPricePerNight?: number
  extraBedTotal?: number
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
  const [filterMode, setFilterMode] = useState<'all' | 'next10days' | 'custom'>('all')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportContentRef = useRef<HTMLDivElement>(null)

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

    // Filter by date range (check-in date only) - Skip if filterMode is 'all'
    if (filterMode !== 'all') {
      const checkIn = parseISO(booking.checkIn)
      const start = parseISO(startDate)
      const end = parseISO(endDate)

      return isWithinInterval(checkIn, { start, end })
    }

    return true
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

  const exportCSV = () => {
    const headers = ['Όνομα', 'Κατάλυμα', 'Check-in', 'Check-out', 'Επαφή', 'Σύνολο (€)', 'Προκαταβολή (€)', 'Τρόπος Πληρωμής', 'Υπόλοιπο (€)', 'Κατάσταση']
    const rows = filteredBookings.map((b) => [
      b.customerName,
      b.property.name,
      format(new Date(b.checkIn), 'dd/MM/yyyy'),
      format(new Date(b.checkOut), 'dd/MM/yyyy'),
      b.contactInfo || '',
      b.totalPrice ? Number(b.totalPrice).toFixed(2) : (b.deposit || '-'),
      b.advancePayment ? Number(b.advancePayment).toFixed(2) : '-',
      b.advancePaymentMethod || '-',
      b.remainingBalance ? Number(b.remainingBalance).toFixed(2) : '-',
      b.status,
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `bookings-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
    link.click()
  }

  const exportPDF = async () => {
    if (!reportContentRef.current) return

    setExporting(true)
    setToast({ message: 'Δημιουργία PDF...', type: 'info' })

    try {
      // Add PDF mode class to hide complex elements
      reportContentRef.current.classList.add('pdf-export-mode')

      // Add max-width to container during PDF export
      const container = document.getElementById('pdf-container')
      if (container) {
        container.classList.add('pdf-export-active')
      }

      // Wait for DOM to update
      await new Promise(resolve => setTimeout(resolve, 100))

      // Capture the report content as canvas with optimized settings
      const canvas = await html2canvas(reportContentRef.current, {
        scale: 1.2, // Reduced from 2 to 1.2 for smaller file size while maintaining readability
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: reportContentRef.current.scrollWidth,
        windowHeight: reportContentRef.current.scrollHeight,
      })

      // Calculate PDF dimensions
      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Create PDF with compression
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true // Enable PDF compression
      })

      // If content is longer than one page, split it
      const pageHeight = 297 // A4 height in mm
      let heightLeft = imgHeight
      let position = 0

      // Add first page
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        position,
        imgWidth,
        imgHeight
      )
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          0,
          position,
          imgWidth,
          imgHeight
        )
        heightLeft -= pageHeight
      }

      // Save the PDF
      pdf.save(`bookings-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`)

      setToast({ message: 'PDF δημιουργήθηκε επιτυχώς!', type: 'success' })
    } catch (error) {
      console.error('Error generating PDF:', error)
      setToast({ message: 'Σφάλμα κατά τη δημιουργία PDF', type: 'error' })
    } finally {
      // Remove PDF mode class
      if (reportContentRef.current) {
        reportContentRef.current.classList.remove('pdf-export-mode')
      }
      // Remove max-width class from container
      const container = document.getElementById('pdf-container')
      if (container) {
        container.classList.remove('pdf-export-active')
      }
      setExporting(false)
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
      <style>{`
        /* PDF export mode adjustments */
        .pdf-export-mode .pdf-badge {
          display: none !important;
        }
        .pdf-export-mode .pdf-text {
          display: block !important;
        }
        .pdf-export-mode .pdf-price-badge {
          background: transparent !important;
          border: none !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          border-radius: 0 !important;
        }
        .pdf-text {
          display: none;
        }

        /* Ensure proper vertical alignment in PDF export */
        .pdf-export-mode table tbody td {
          padding: 14px 12px !important;
        }
        .pdf-export-mode table tbody td .flex.flex-col {
          margin-top: -2px;
          margin-bottom: -2px;
        }
        .pdf-export-mode table tbody td .flex.items-center svg {
          transform: translateY(3px);
          overflow: visible !important;
        }
        .pdf-export-mode table tbody td .flex.items-center {
          overflow: visible !important;
        }

        /* Add max-width to container during PDF export */
        #pdf-container.pdf-export-active {
          max-width: 80rem !important;
        }
      `}</style>
      <Header />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto" id="pdf-container">
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
                  disabled={exporting}
                  className="px-2.5 py-2 md:px-3 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="hidden md:inline">Δημιουργία...</span>
                    </>
                  ) : (
                    'PDF'
                  )}
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
                    {filteredBookings.filter(b => true).length}
                  </span>
                </button>
                {properties.map((prop) => {
                  const propBookingCount = filteredBookings.filter(b => b.property.id === prop.id).length
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

            {/* Filter Mode Buttons - Single Row */}
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
                    maxDate={endDate || undefined}
                    highlightDate={endDate || undefined}
                  />
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="Ημερομηνία"
                    minDate={startDate || undefined}
                    highlightDate={startDate || undefined}
                    initialMonth={startDate || undefined}
                  />
                </div>
              </div>
            )}

            {/* Report Content - This will be captured for PDF */}
            <div ref={reportContentRef}>
            {/* Report Header with Date Range */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 text-center mb-1">Αναφορά Κρατήσεων</h2>
              <p className="text-sm text-gray-600 text-center">
                {filterMode === 'all' ? (
                  'Όλες οι κρατήσεις'
                ) : (
                  `Περίοδος: ${format(parseISO(startDate), 'd MMM yyyy', { locale: el })} - ${format(parseISO(endDate), 'd MMM yyyy', { locale: el })}`
                )}
              </p>
            </div>

            {/* Check-ins Count */}
            {filteredBookings.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-200">
                <div className="text-center">
                  <span className="text-sm text-gray-600">
                    {filterMode === 'all' ? 'Σύνολο: ' : 'Αναμενόμενα: '}
                  </span>
                  <span className="text-sm font-bold text-blue-600">{filteredBookings.length} κρατήσεις</span>
                </div>
              </div>
            )}

            {/* Financial Summary */}
            {filteredBookings.length > 0 && (
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Οικονομική Περίληψη</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <div className="text-xs text-blue-700 font-semibold mb-1">Σύνολο Εσόδων</div>
                    <div className="text-2xl font-bold text-blue-600">€{financialSummary.totalRevenue.toFixed(2)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <div className="text-xs text-green-700 font-semibold mb-1">Σύνολο Προκαταβολών</div>
                    <div className="text-2xl font-bold text-green-600">€{financialSummary.totalAdvances.toFixed(2)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                    <div className="text-xs text-amber-700 font-semibold mb-1">Σύνολο Υπολοίπων</div>
                    <div className="text-2xl font-bold text-amber-600">€{financialSummary.totalRemaining.toFixed(2)}</div>
                  </div>
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
                            {/* Header with Customer Name and Property */}
                            <div className="bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-3 border-b border-gray-200">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-bold text-lg text-gray-900 truncate">
                                    {booking.customerName}
                                  </h3>
                                  {booking.extraBedEnabled && (
                                    <div className="pdf-text text-purple-700 text-xs font-semibold mt-0.5">
                                      Extra Κρεβάτι
                                    </div>
                                  )}
                                </div>
                                {booking.extraBedEnabled && (
                                  <span className="flex-shrink-0 pdf-badge inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold border border-purple-300" title="Extra Κρεβάτι">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                                      <path d="M21 16V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8"/>
                                      <path d="M2 16h20"/>
                                      <path d="M2 20h20"/>
                                      <circle cx="7" cy="6" r="2"/>
                                    </svg>
                                    <span>+1</span>
                                  </span>
                                )}
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
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                                    {booking.contactChannel === 'email' ? (
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                      </svg>
                                    ) : booking.contactChannel === 'viber' ? (
                                      <svg className="w-5 h-5" viewBox="0 0 512 512" fill="#7360F2">
                                        <path d="M444 49.9C431.3 38.2 379.9.9 265.3.4c0 0-135.1-8.1-200.9 52.3C27.8 89.3 14.9 143 13.5 209.5c-1.4 66.5-3.1 191.1 117 224.9h.1l-.1 51.6s-.8 20.9 13 25.1c16.6 5.2 26.4-10.7 42.3-27.8 8.7-9.4 20.7-23.2 29.8-33.7 82.2 6.9 145.3-8.9 152.5-11.2 16.6-5.4 110.5-17.4 125.7-142 15.8-128.6-7.6-209.8-49.8-246.5zM457.9 287c-12.9 104-89 110.6-103 115.1-6 1.9-61.5 15.7-131.2 11.2 0 0-52 62.7-68.2 79-5.3 5.3-11.1 4.8-11-5.7 0-6.9.4-85.7.4-85.7-.1 0-.1 0 0 0-101.8-28.2-95.8-134.3-94.7-189.8 1.1-55.5 11.6-101 42.6-131.6 55.7-50.5 170.4-43 170.4-43 96.9.4 143.3 29.6 154.1 39.4 35.7 30.6 53.9 103.8 40.6 211.1zm-139-80.8c.4 8.6-12.5 9.2-12.9.6-1.1-22-11.4-32.7-32.6-33.9-8.6-.5-7.8-13.4.7-12.9 27.9 1.5 43.4 17.5 44.8 46.2zm20.3 11.3c1-42.4-25.5-75.6-75.8-79.3-8.5-.6-7.6-13.5.9-12.9 58 4.2 88.9 44.1 87.8 92.5-.1 8.6-13.1 8.2-12.9-.3zm47 13.4c.1 8.6-12.9 8.7-12.9.1-.6-81.5-54.9-125.9-120.8-126.4-8.5-.1-8.5-12.9 0-12.9 73.7.5 133 51.4 133.7 139.2zM374.9 329v.2c-10.8 19-31 40-51.8 33.3l-.2-.3c-21.1-5.9-70.8-31.5-102.2-56.5-16.2-12.8-31-27.9-42.4-42.4-10.3-12.9-20.7-28.2-30.8-46.6-21.3-38.5-26-55.7-26-55.7-6.7-20.8 14.2-41 33.3-51.8h.2c9.2-4.8 18-3.2 23.9 3.9 0 0 12.4 14.8 17.7 22.1 5 6.8 11.7 17.7 15.2 23.8 6.1 10.9 2.3 22-3.7 26.6l-12 9.6c-6.1 4.9-5.3 14-5.3 14s17.8 67.3 84.3 84.3c0 0 9.1.8 14-5.3l9.6-12c4.6-6 15.7-9.8 26.6-3.7 14.7 8.3 33.4 21.2 45.8 32.9 7 5.7 8.6 14.4 3.8 23.6z"/>
                                      </svg>
                                    ) : booking.contactChannel === 'messenger' ? (
                                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#0084FF">
                                        <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.11C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/>
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                      </svg>
                                    )}
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
                                  {booking.extraBedEnabled && (
                                    <div className="pdf-price-badge flex justify-between items-center text-xs text-purple-700 bg-purple-50 -mx-3 px-3 py-1.5">
                                      <span className="font-medium">Extra Κρεβάτι (€{Number(booking.extraBedPricePerNight || 0).toFixed(2)}/νύχτα)</span>
                                      <span className="font-bold">
                                        {booking.extraBedTotal && booking.extraBedTotal > 0
                                          ? `€${Number(booking.extraBedTotal).toFixed(2)}`
                                          : '(Δωρεάν)'}
                                      </span>
                                    </div>
                                  )}
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
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDates.map((date) => (
                          groupedBookings[date].map((booking, index) => (
                            <tr key={booking.id} className={`border-b hover:bg-gray-50 ${index === 0 ? 'border-t-2 border-t-blue-600' : ''}`}>
                              {index === 0 && (
                                <td className="p-3 font-bold text-blue-600 bg-blue-50" rowSpan={groupedBookings[date].length} style={{ verticalAlign: 'middle' }}>
                                  {format(parseISO(date), 'd MMM yyyy', { locale: el })}
                                </td>
                              )}
                              <td className="p-3 font-semibold" style={{ verticalAlign: 'middle' }}>
                                <div className="flex items-center gap-2">
                                  <div>
                                    <div>{booking.customerName}</div>
                                    {booking.extraBedEnabled && (
                                      <div className="pdf-text text-purple-700 text-xs font-semibold mt-1">
                                        Extra Κρεβάτι
                                      </div>
                                    )}
                                  </div>
                                  {booking.extraBedEnabled && (
                                    <span className="pdf-badge inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold border border-purple-300" title="Extra Κρεβάτι">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M21 16V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8"/>
                                        <path d="M2 16h20"/>
                                        <path d="M2 20h20"/>
                                        <circle cx="7" cy="6" r="2"/>
                                      </svg>
                                      +1
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3" style={{ verticalAlign: 'middle' }}>{booking.property.name}</td>
                              <td className="p-3" style={{ verticalAlign: 'middle' }}>{format(parseISO(booking.checkOut), 'd MMM yyyy', { locale: el })}</td>
                              <td className="p-3" style={{ verticalAlign: 'middle' }}>
                                {booking.contactInfo ? (
                                  <div className="flex items-center gap-2">
                                    {booking.contactChannel === 'email' ? (
                                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                      </svg>
                                    ) : booking.contactChannel === 'viber' ? (
                                      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 512 512" fill="#7360F2">
                                        <path d="M444 49.9C431.3 38.2 379.9.9 265.3.4c0 0-135.1-8.1-200.9 52.3C27.8 89.3 14.9 143 13.5 209.5c-1.4 66.5-3.1 191.1 117 224.9h.1l-.1 51.6s-.8 20.9 13 25.1c16.6 5.2 26.4-10.7 42.3-27.8 8.7-9.4 20.7-23.2 29.8-33.7 82.2 6.9 145.3-8.9 152.5-11.2 16.6-5.4 110.5-17.4 125.7-142 15.8-128.6-7.6-209.8-49.8-246.5zM457.9 287c-12.9 104-89 110.6-103 115.1-6 1.9-61.5 15.7-131.2 11.2 0 0-52 62.7-68.2 79-5.3 5.3-11.1 4.8-11-5.7 0-6.9.4-85.7.4-85.7-.1 0-.1 0 0 0-101.8-28.2-95.8-134.3-94.7-189.8 1.1-55.5 11.6-101 42.6-131.6 55.7-50.5 170.4-43 170.4-43 96.9.4 143.3 29.6 154.1 39.4 35.7 30.6 53.9 103.8 40.6 211.1zm-139-80.8c.4 8.6-12.5 9.2-12.9.6-1.1-22-11.4-32.7-32.6-33.9-8.6-.5-7.8-13.4.7-12.9 27.9 1.5 43.4 17.5 44.8 46.2zm20.3 11.3c1-42.4-25.5-75.6-75.8-79.3-8.5-.6-7.6-13.5.9-12.9 58 4.2 88.9 44.1 87.8 92.5-.1 8.6-13.1 8.2-12.9-.3zm47 13.4c.1 8.6-12.9 8.7-12.9.1-.6-81.5-54.9-125.9-120.8-126.4-8.5-.1-8.5-12.9 0-12.9 73.7.5 133 51.4 133.7 139.2zM374.9 329v.2c-10.8 19-31 40-51.8 33.3l-.2-.3c-21.1-5.9-70.8-31.5-102.2-56.5-16.2-12.8-31-27.9-42.4-42.4-10.3-12.9-20.7-28.2-30.8-46.6-21.3-38.5-26-55.7-26-55.7-6.7-20.8 14.2-41 33.3-51.8h.2c9.2-4.8 18-3.2 23.9 3.9 0 0 12.4 14.8 17.7 22.1 5 6.8 11.7 17.7 15.2 23.8 6.1 10.9 2.3 22-3.7 26.6l-12 9.6c-6.1 4.9-5.3 14-5.3 14s17.8 67.3 84.3 84.3c0 0 9.1.8 14-5.3l9.6-12c4.6-6 15.7-9.8 26.6-3.7 14.7 8.3 33.4 21.2 45.8 32.9 7 5.7 8.6 14.4 3.8 23.6z"/>
                                      </svg>
                                    ) : booking.contactChannel === 'messenger' ? (
                                      <svg className="w-5 h-5 flex-shrink-0" viewBox="-2 -2 28 28" fill="#0084FF">
                                        <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.11C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/>
                                      </svg>
                                    ) : (
                                      <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                      </svg>
                                    )}
                                    <span>{booking.contactInfo}</span>
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="p-3 text-right font-bold text-blue-600" style={{ verticalAlign: 'middle' }}>
                                <div className="flex flex-col items-end gap-1">
                                  <span>{booking.totalPrice ? `€${Number(booking.totalPrice).toFixed(2)}` : (booking.deposit || '-')}</span>
                                  {booking.extraBedEnabled && (
                                    <span className="pdf-price-badge inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold" title="Extra Κρεβάτι">
                                      {booking.extraBedTotal && booking.extraBedTotal > 0
                                        ? `+€${Number(booking.extraBedTotal).toFixed(2)}`
                                        : '(Δωρεάν)'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right font-semibold text-green-600" style={{ verticalAlign: 'middle' }}>
                                {booking.advancePayment ? `€${Number(booking.advancePayment).toFixed(2)}` : '-'}
                              </td>
                              <td className="p-3 text-xs" style={{ verticalAlign: 'middle' }}>
                                <div>{booking.advancePaymentMethod || '-'}</div>
                                {booking.advancePaymentDate && (
                                  <div className="text-gray-500 mt-1">
                                    {format(parseISO(booking.advancePaymentDate), 'd/MM', { locale: el })}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-right font-semibold text-amber-600" style={{ verticalAlign: 'middle' }}>
                                {booking.remainingBalance ? `€${Number(booking.remainingBalance).toFixed(2)}` : '-'}
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
            {/* End Report Content */}
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
