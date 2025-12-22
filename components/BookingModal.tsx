'use client'

import { useState, useEffect } from 'react'
import { eachDayOfInterval, parseISO, format } from 'date-fns'
import { el } from 'date-fns/locale'
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
    totalPrice?: number
    advancePayment?: number | null
    remainingBalance?: number | null
    advancePaymentMethod?: string | null
    advancePaymentDate?: string | null
    perPropertyPrices?: { [propertyId: string]: number } // Added for multi-property bookings
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
    totalPrice?: number
    advancePayment?: number
    remainingBalance?: number
    advancePaymentMethod?: string
    advancePaymentDate?: string
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
  const [priceCalculation, setPriceCalculation] = useState<{
    success: boolean
    totalPrice?: number
    nightsCount?: number
    missingDates?: string[]
    breakdown?: Array<{ date: string; price: number }>
    perPropertyPrices?: { [propertyId: string]: number } // Added for multi-property bookings
  } | null>(
    // Initialize from existing data if editing
    initialData?.totalPrice && initialData?.checkIn && initialData?.checkOut ? {
      success: true,
      totalPrice: Number(initialData.totalPrice),
      nightsCount: Math.ceil((new Date(initialData.checkOut).getTime() - new Date(initialData.checkIn).getTime()) / (1000 * 60 * 60 * 24))
    } : null
  )
  const [customPrices, setCustomPrices] = useState<{ [date: string]: number }>({})
  const [advancePayment, setAdvancePayment] = useState<string>(
    initialData?.advancePayment ? Number(initialData.advancePayment).toString() : ''
  )
  const [remainingBalance, setRemainingBalance] = useState<number>(
    initialData?.remainingBalance ? Number(initialData.remainingBalance) : 0
  )
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<string>(
    initialData?.advancePaymentMethod || ''
  )
  const [advancePaymentDate, setAdvancePaymentDate] = useState<string>(
    initialData?.advancePaymentDate || ''
  )
  const [calculatingPrice, setCalculatingPrice] = useState(false)
  const [dateConflicts, setDateConflicts] = useState<string[]>([])
  const [checkOutDisabledDates, setCheckOutDisabledDates] = useState<string[]>([])

  // Prevent body scroll when modal is open
  useEffect(() => {
    // Save original overflow style
    const originalOverflow = document.body.style.overflow

    // Disable body scroll
    document.body.style.overflow = 'hidden'

    // Re-enable scroll on cleanup
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // Fetch bookings to calculate disabled dates
  useEffect(() => {
    if (businessId && !isEdit) {
      fetchBookings()
    }
  }, [businessId, isEdit])

  // Calculate price when dates change (for both single and multi-property bookings)
  useEffect(() => {
    if (formData.checkIn && formData.checkOut && formData.propertyIds.length > 0) {
      // Always calculate to get the total and breakdown
      if (formData.propertyIds.length === 1) {
        // Single property: get detailed breakdown
        calculatePrice()
      } else {
        // Multiple properties: calculate combined total
        calculateMultiPropertyPrice()
      }
      // Clear custom prices when dates change (but not on initial load in edit mode)
      if (!isEdit) {
        setCustomPrices({})
      }
    } else {
      // Don't clear price calculation if editing with existing data
      if (!isEdit || !initialData?.totalPrice) {
        setPriceCalculation(null)
        setCustomPrices({})
      }
    }
  }, [formData.checkIn, formData.checkOut, formData.propertyIds])

  // Recalculate total when custom prices change
  useEffect(() => {
    if (priceCalculation && priceCalculation.success && priceCalculation.breakdown) {
      // Check if any custom prices exist
      if (Object.keys(customPrices).length > 0) {
        // Calculate new total from breakdown with custom prices (per property)
        const pricePerProperty = priceCalculation.breakdown.reduce((sum, item) => {
          const customPrice = customPrices[item.date]
          return sum + (customPrice !== undefined ? customPrice : item.price)
        }, 0)

        const roundedPricePerProperty = Math.round(pricePerProperty * 100) / 100

        // For multi-property bookings, update perPropertyPrices
        let updatedPerPropertyPrices = priceCalculation.perPropertyPrices
        if (formData.propertyIds.length > 1 && priceCalculation.perPropertyPrices) {
          updatedPerPropertyPrices = {}
          formData.propertyIds.forEach(propertyId => {
            updatedPerPropertyPrices![propertyId] = roundedPricePerProperty
          })
        }

        // Update priceCalculation with new total and per-property prices
        setPriceCalculation(prev => prev ? {
          ...prev,
          totalPrice: formData.propertyIds.length > 1
            ? roundedPricePerProperty * formData.propertyIds.length
            : roundedPricePerProperty,
          perPropertyPrices: updatedPerPropertyPrices
        } : null)
      }
    }
  }, [customPrices, formData.propertyIds])

  // Calculate remaining balance when advance payment changes
  useEffect(() => {
    if (priceCalculation && priceCalculation.success && priceCalculation.totalPrice) {
      const advance = parseFloat(advancePayment) || 0
      setRemainingBalance(priceCalculation.totalPrice - advance)
    }
  }, [advancePayment, priceCalculation])

  // Calculate disabled dates when bookings or selected properties change
  useEffect(() => {
    if (!isEdit && formData.propertyIds.length > 0) {
      calculateDisabledDates()
    }
  }, [bookings, formData.propertyIds, isEdit])

  // Calculate which check-out dates would create invalid ranges
  useEffect(() => {
    if (!isEdit && formData.checkIn && disabledDates.length > 0) {
      const checkInDate = parseISO(formData.checkIn)
      const additionalDisabledDates: string[] = []

      // For each potential check-out date in the future
      // Check if there are any disabled dates between check-in and that date
      // If yes, disable that check-out date
      const maxFutureDays = 365 // Check up to 1 year in the future
      for (let i = 1; i <= maxFutureDays; i++) {
        const potentialCheckOut = format(new Date(checkInDate.getTime() + i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

        // Get all dates between check-in and this potential check-out
        const datesInBetween = eachDayOfInterval({
          start: checkInDate,
          end: new Date(potentialCheckOut)
        }).map(d => format(d, 'yyyy-MM-dd'))

        // Check if any of these dates (except the endpoints) are disabled
        const hasDisabledInRange = datesInBetween.some(date =>
          date !== formData.checkIn && // Don't count check-in itself
          date !== potentialCheckOut && // Don't count check-out itself (we want to allow checking out on a day that has a booking starting)
          disabledDates.includes(date)
        )

        if (hasDisabledInRange) {
          additionalDisabledDates.push(potentialCheckOut)
        }
      }

      setCheckOutDisabledDates([...disabledDates, ...additionalDisabledDates])
    } else {
      setCheckOutDisabledDates(disabledDates)
    }
  }, [formData.checkIn, disabledDates, isEdit])

  // Check for date conflicts in real-time
  useEffect(() => {
    if (!isEdit && formData.checkIn && formData.checkOut && formData.propertyIds.length > 0) {
      const checkInDate = parseISO(formData.checkIn)
      const checkOutDate = parseISO(formData.checkOut)
      const conflicts: string[] = []

      formData.propertyIds.forEach(propertyId => {
        const property = properties.find(p => p.id === propertyId)
        const propertyBookings = bookings.filter(
          b => b.property.id === propertyId &&
               b.status === 'active' &&
               b.id !== currentBookingId
        )

        // Check if any booking overlaps with selected dates
        const hasConflict = propertyBookings.some(booking => {
          const bookingStart = parseISO(booking.checkIn)
          const bookingEnd = parseISO(booking.checkOut)

          // Overlap logic: (Start1 < End2) AND (End1 > Start2)
          return checkInDate < bookingEnd && checkOutDate > bookingStart
        })

        if (hasConflict) {
          conflicts.push(property?.name || 'Unknown')
        }
      })

      setDateConflicts(conflicts)
    } else {
      setDateConflicts([])
    }
  }, [formData.checkIn, formData.checkOut, formData.propertyIds, bookings, isEdit, currentBookingId, properties])

  const fetchBookings = async () => {
    try {
      const res = await fetch(`/api/bookings?businessId=${businessId}`)
      const data = await res.json()
      setBookings(data)
    } catch (error) {
      console.error('Error fetching bookings:', error)
    }
  }

  const calculatePrice = async () => {
    if (!formData.checkIn || !formData.checkOut || formData.propertyIds.length !== 1) return

    setCalculatingPrice(true)
    try {
      const res = await fetch('/api/bookings/calculate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: formData.propertyIds[0],
          checkIn: formData.checkIn,
          checkOut: formData.checkOut
        })
      })

      const data = await res.json()
      setPriceCalculation(data)
    } catch (error) {
      console.error('Error calculating price:', error)
      setPriceCalculation({
        success: false,
        missingDates: []
      })
    } finally {
      setCalculatingPrice(false)
    }
  }

  const calculateMultiPropertyPrice = async () => {
    if (!formData.checkIn || !formData.checkOut || formData.propertyIds.length === 0) return

    setCalculatingPrice(true)
    try {
      // Fetch price breakdown from first property (applies to all properties)
      const res = await fetch('/api/bookings/calculate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: formData.propertyIds[0],
          checkIn: formData.checkIn,
          checkOut: formData.checkOut
        })
      })

      const data = await res.json()

      if (!data.success && data.missingDates) {
        setPriceCalculation({
          success: false,
          missingDates: data.missingDates
        })
      } else if (data.success) {
        const pricePerProperty = data.totalPrice || 0
        const combinedTotal = pricePerProperty * formData.propertyIds.length

        // Create per-property prices (all the same)
        const perPropertyPrices: { [propertyId: string]: number } = {}
        formData.propertyIds.forEach(propertyId => {
          perPropertyPrices[propertyId] = pricePerProperty
        })

        setPriceCalculation({
          success: true,
          totalPrice: combinedTotal,
          nightsCount: data.nightsCount || 0,
          breakdown: data.breakdown, // Include breakdown for UI
          perPropertyPrices
        })
      }
    } catch (error) {
      console.error('Error calculating multi-property price:', error)
      setPriceCalculation({
        success: false,
        missingDates: []
      })
    } finally {
      setCalculatingPrice(false)
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

  // Helper function to group consecutive dates by price
  const groupByPrice = (breakdown: Array<{ date: string; price: number }>) => {
    const groups: Array<{
      price: number
      dates: Array<{ date: string; price: number }>
      dateFrom: string
      dateTo: string
    }> = []

    breakdown.forEach((item) => {
      const currentPrice = customPrices[item.date] !== undefined ? customPrices[item.date] : item.price
      const lastGroup = groups[groups.length - 1]

      // If same price as last group and consecutive date, add to that group
      if (lastGroup && lastGroup.price === currentPrice) {
        lastGroup.dates.push(item)
        lastGroup.dateTo = item.date
      } else {
        // Create new group
        groups.push({
          price: currentPrice,
          dates: [item],
          dateFrom: item.date,
          dateTo: item.date
        })
      }
    })

    return groups
  }

  const handlePriceChange = (date: string, value: string) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      setCustomPrices(prev => ({
        ...prev,
        [date]: numValue
      }))
    } else if (value === '') {
      // Reset to original price
      setCustomPrices(prev => {
        const newPrices = { ...prev }
        delete newPrices[date]
        return newPrices
      })
    }
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

    // Check for date conflicts (should be caught by disabled button, but double-check)
    if (dateConflicts.length > 0) {
      alert(`❌ Τα ακόλουθα καταλύματα δεν είναι διαθέσιμα για τις επιλεγμένες ημερομηνίες:\n\n${dateConflicts.join('\n')}\n\nΠαρακαλώ επιλέξτε διαφορετικές ημερομηνίες ή άλλα καταλύματα.`)
      return
    }

    // Check if booking is blocked due to missing prices
    if (priceCalculation && !priceCalculation.success) {
      alert('Δεν υπάρχουν τιμές για όλες τις ημερομηνίες. Παρακαλώ ορίστε τιμές στον τιμοκατάλογο πρώτα.')
      return
    }

    // Include price data in submission
    const submissionData = {
      ...formData,
      totalPrice: priceCalculation?.totalPrice,
      advancePayment: parseFloat(advancePayment) || null,
      remainingBalance: remainingBalance || null,
      advancePaymentMethod: advancePaymentMethod || null,
      advancePaymentDate: advancePaymentDate || null,
      perPropertyPrices: priceCalculation?.perPropertyPrices // Include per-property prices for multi-property bookings
    }

    onSave(submissionData as any)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 md:flex md:items-center md:justify-center z-[70] md:p-4 overflow-y-auto">
      <div className="bg-white h-full md:h-auto md:max-h-[90vh] md:rounded-2xl shadow-2xl md:max-w-2xl w-full md:my-8 animate-scale-in flex flex-col">
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
                disabledDates={checkOutDisabledDates}
                isEditMode={isEdit}
                minDate={formData.checkIn || format(new Date(), 'yyyy-MM-dd')}
                highlightDate={formData.checkIn || undefined}
                initialMonth={formData.checkIn || undefined}
              />
            </div>
          </div>

          {/* Date Conflict Warning */}
          {dateConflicts.length > 0 && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-red-800 font-bold mb-1">❌ Σύγκρουση Ημερομηνιών!</h4>
                  <p className="text-red-700 text-sm mb-2">
                    Τα ακόλουθα καταλύματα δεν είναι διαθέσιμα για τις επιλεγμένες ημερομηνίες:
                  </p>
                  <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                    {dateConflicts.map((propertyName, idx) => (
                      <li key={idx} className="font-semibold">{propertyName}</li>
                    ))}
                  </ul>
                  <p className="text-red-700 text-sm mt-2 font-medium">
                    Παρακαλώ επιλέξτε διαφορετικές ημερομηνίες ή άλλα καταλύματα.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Price Calculation - Only for single property bookings */}
          {formData.propertyIds.length === 1 && formData.checkIn && formData.checkOut && (
            <>
              {calculatingPrice ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-600">
                  Υπολογισμός τιμής...
                </div>
              ) : priceCalculation && priceCalculation.success && priceCalculation.totalPrice ? (
                <>
                  {/* Per-Night Price Breakdown */}
                  {priceCalculation.breakdown && priceCalculation.breakdown.length > 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-700">Τιμές ανά Νύχτα</h4>
                        <span className="text-xs text-gray-500">Μπορείτε να επεξεργαστείτε τις τιμές</span>
                      </div>

                      <div className="space-y-3">
                        {groupByPrice(priceCalculation.breakdown).map((group, groupIndex) => {
                          // Check if this group has been customized
                          const groupKey = `group_${groupIndex}`
                          const isCustom = customPrices[groupKey] !== undefined
                          const displayPrice = isCustom ? customPrices[groupKey] : group.price
                          const subtotal = displayPrice * group.dates.length

                          return (
                            <div key={groupIndex} className={`border-2 rounded-lg p-4 transition-colors ${
                              isCustom ? 'bg-orange-50 border-orange-400' : 'bg-gray-50 border-gray-200'
                            }`}>
                              {/* Date Range Header */}
                              <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-semibold text-gray-700">
                                  {group.dateFrom === group.dateTo ? (
                                    format(parseISO(group.dateFrom), 'd MMM yyyy', { locale: el })
                                  ) : (
                                    <>
                                      {format(parseISO(group.dateFrom), 'd MMM', { locale: el })} - {format(parseISO(group.dateTo), 'd MMM yyyy', { locale: el })}
                                    </>
                                  )}
                                  <span className="ml-2 text-xs text-gray-500">({group.dates.length} {group.dates.length === 1 ? 'νύχτα' : 'νύχτες'})</span>
                                </div>
                              </div>

                              {/* Price Input */}
                              <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                  Τιμή / νύχτα:
                                </label>
                                <div className="relative flex-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={displayPrice}
                                    onChange={(e) => {
                                      const value = e.target.value
                                      const numValue = parseFloat(value)
                                      if (!isNaN(numValue) && numValue >= 0) {
                                        setCustomPrices(prev => ({
                                          ...prev,
                                          [groupKey]: numValue
                                        }))
                                        // Apply this price to all dates in this group
                                        group.dates.forEach(item => {
                                          setCustomPrices(prev => ({
                                            ...prev,
                                            [item.date]: numValue
                                          }))
                                        })
                                      }
                                    }}
                                    className={`w-full h-[52px] px-4 border-2 rounded-lg text-base font-semibold focus:outline-none transition-colors ${
                                      isCustom
                                        ? 'border-orange-400 bg-white focus:border-orange-500 text-orange-700'
                                        : 'border-gray-300 bg-white focus:border-blue-500 text-gray-900'
                                    }`}
                                  />
                                  {isCustom && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Reset group price
                                        setCustomPrices(prev => {
                                          const newPrices = { ...prev }
                                          delete newPrices[groupKey]
                                          // Also reset individual date prices in this group
                                          group.dates.forEach(item => {
                                            delete newPrices[item.date]
                                          })
                                          return newPrices
                                        })
                                      }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-orange-500 text-white rounded-full text-sm hover:bg-orange-600 flex items-center justify-center"
                                      title="Επαναφορά"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                                <span className="text-sm text-gray-500">€</span>
                              </div>

                              {/* Subtotal */}
                              <div className="mt-3 pt-3 border-t border-gray-300 flex justify-between items-center">
                                <span className="text-sm text-gray-600">Υποσύνολο:</span>
                                <span className="text-lg font-bold text-gray-800">
                                  €{subtotal.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Info message if custom prices exist */}
                      {Object.keys(customPrices).filter(key => key.startsWith('group_')).length > 0 && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700 flex items-start gap-2">
                          <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span>Έχετε τροποποιήσει προσαρμοσμένες τιμές. Κλικ στο × για επαναφορά στις αρχικές τιμές.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Total Price Display */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-700">Σύνολο:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        €{Number(priceCalculation.totalPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {priceCalculation.nightsCount} {priceCalculation.nightsCount === 1 ? 'νύχτα' : 'νύχτες'}
                    </div>
                  </div>

                  {/* Advance Payment, Payment Method and Date */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    {/* Row 1: Advance Payment */}
                    <div className="mb-3">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Προκαταβολή (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={Number(priceCalculation.totalPrice)}
                        value={advancePayment}
                        onChange={(e) => setAdvancePayment(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white h-[52px]"
                      />
                    </div>

                    {/* Row 2: Payment Method and Date */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Τρόπος Πληρωμής *</label>
                        <select
                          value={advancePaymentMethod}
                          onChange={(e) => setAdvancePaymentMethod(e.target.value)}
                          className="w-full px-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white h-[52px]"
                          disabled={!advancePayment || parseFloat(advancePayment) === 0}
                        >
                          <option value=""></option>
                          <option value="Revolut">Revolut</option>
                          <option value="Πειραιώς">Πειραιώς</option>
                          <option value="MoneyGram">MoneyGram</option>
                          <option value="Western Union">Western Union</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Ημερομηνία Πληρωμής *</label>
                        <div className="h-[52px]">
                          <DatePicker
                            value={advancePaymentDate}
                            onChange={(date) => setAdvancePaymentDate(date)}
                            placeholder=""
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Remaining Balance Display - Only show when advance payment entered */}
                  {advancePayment && parseFloat(advancePayment) > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-700">Υπόλοιπο:</span>
                        <span className="text-2xl font-bold text-amber-600">
                          €{Number(remainingBalance).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : priceCalculation && !priceCalculation.success && priceCalculation.missingDates && priceCalculation.missingDates.length > 0 ? (
                /* Error: Missing Prices */
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-bold mb-1">
                    ❌ Δεν υπάρχουν τιμές για όλες τις ημερομηνίες!
                  </p>
                  <p className="text-sm text-red-600">
                    Παρακαλώ ορίστε τιμές στον τιμοκατάλογο πρώτα.
                  </p>
                </div>
              ) : null}
            </>
          )}

          {/* Multi-property booking price display */}
          {formData.propertyIds.length > 1 && formData.checkIn && formData.checkOut && (
            <>
              {calculatingPrice ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-600">
                  Υπολογισμός τιμής...
                </div>
              ) : priceCalculation && priceCalculation.success && priceCalculation.totalPrice && priceCalculation.breakdown ? (
                <>
                  {/* Per-Night Price Breakdown (shared for all properties) */}
                  <div className="bg-white border border-gray-300 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-700">Τιμές ανά Νύχτα</h4>
                      <span className="text-xs text-gray-500">Μπορείτε να επεξεργαστείτε τις τιμές</span>
                    </div>

                    <div className="space-y-3">
                      {groupByPrice(priceCalculation.breakdown).map((group, groupIndex) => {
                        const groupKey = `group_${groupIndex}`
                        const isCustom = customPrices[groupKey] !== undefined
                        const displayPrice = isCustom ? customPrices[groupKey] : group.price
                        const subtotal = displayPrice * group.dates.length

                        return (
                          <div key={groupIndex} className={`border-2 rounded-lg p-4 transition-colors ${
                            isCustom ? 'bg-orange-50 border-orange-400' : 'bg-gray-50 border-gray-200'
                          }`}>
                            {/* Date Range Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-sm font-semibold text-gray-700">
                                {group.dateFrom === group.dateTo ? (
                                  format(parseISO(group.dateFrom), 'd MMM yyyy', { locale: el })
                                ) : (
                                  <>
                                    {format(parseISO(group.dateFrom), 'd MMM', { locale: el })} - {format(parseISO(group.dateTo), 'd MMM yyyy', { locale: el })}
                                  </>
                                )}
                                <span className="ml-2 text-xs text-gray-500">({group.dates.length} {group.dates.length === 1 ? 'νύχτα' : 'νύχτες'})</span>
                              </div>
                            </div>

                            {/* Price Input */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                Τιμή / νύχτα:
                              </label>
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={displayPrice}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    const numValue = parseFloat(value)
                                    if (!isNaN(numValue) && numValue >= 0) {
                                      setCustomPrices(prev => ({
                                        ...prev,
                                        [groupKey]: numValue
                                      }))
                                      // Apply this price to all dates in this group
                                      group.dates.forEach(item => {
                                        setCustomPrices(prev => ({
                                          ...prev,
                                          [item.date]: numValue
                                        }))
                                      })
                                    }
                                  }}
                                  className={`w-full h-[52px] px-4 border-2 rounded-lg text-base font-semibold focus:outline-none transition-colors ${
                                    isCustom
                                      ? 'border-orange-400 bg-white focus:border-orange-500 text-orange-700'
                                      : 'border-gray-300 bg-white focus:border-blue-500 text-gray-900'
                                  }`}
                                />
                                {isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Reset group price
                                      setCustomPrices(prev => {
                                        const newPrices = { ...prev }
                                        delete newPrices[groupKey]
                                        // Also reset individual date prices in this group
                                        group.dates.forEach(item => {
                                          delete newPrices[item.date]
                                        })
                                        return newPrices
                                      })
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-orange-500 text-white rounded-full text-sm hover:bg-orange-600 flex items-center justify-center"
                                    title="Επαναφορά"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                              <span className="text-sm text-gray-500">€</span>
                            </div>

                            {/* Subtotal per property */}
                            <div className="mt-3 pt-3 border-t border-gray-300 flex justify-between items-center">
                              <span className="text-sm text-gray-600">Υποσύνολο:</span>
                              <span className="text-lg font-bold text-gray-800">
                                €{subtotal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Info message if custom prices exist */}
                    {Object.keys(customPrices).filter(key => key.startsWith('group_')).length > 0 && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700 flex items-start gap-2">
                        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Έχετε τροποποιήσει προσαρμοσμένες τιμές. Κλικ στο × για επαναφορά στις αρχικές τιμές.</span>
                      </div>
                    )}
                  </div>

                  {/* Per-Property Prices */}
                  {priceCalculation.perPropertyPrices && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-bold text-gray-700 mb-3">Τιμή ανά Κατάλυμα:</h4>
                      <div className="space-y-2">
                        {formData.propertyIds.map(propertyId => {
                          const property = properties.find(p => p.id === propertyId)
                          const price = priceCalculation.perPropertyPrices![propertyId]
                          return (
                            <div key={propertyId} className="flex justify-between items-center bg-white rounded-lg p-3">
                              <span className="font-medium text-gray-700">{property?.name || 'Unknown'}</span>
                              <span className="text-lg font-bold text-gray-900">€{Number(price).toFixed(2)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Total Price Display for Multiple Properties */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-700">Σύνολο:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        €{Number(priceCalculation.totalPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {priceCalculation.nightsCount} {priceCalculation.nightsCount === 1 ? 'νύχτα' : 'νύχτες'}
                    </div>
                  </div>

                  {/* Advance Payment, Payment Method and Date */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    {/* Row 1: Advance Payment */}
                    <div className="mb-3">
                      <label className="block text-sm font-bold text-gray-700 mb-2">Προκαταβολή (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={Number(priceCalculation.totalPrice)}
                        value={advancePayment}
                        onChange={(e) => setAdvancePayment(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white h-[52px]"
                      />
                    </div>

                    {/* Row 2: Payment Method and Date */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Τρόπος Πληρωμής *</label>
                        <select
                          value={advancePaymentMethod}
                          onChange={(e) => setAdvancePaymentMethod(e.target.value)}
                          className="w-full px-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white h-[52px]"
                          disabled={!advancePayment || parseFloat(advancePayment) === 0}
                        >
                          <option value=""></option>
                          <option value="Revolut">Revolut</option>
                          <option value="Πειραιώς">Πειραιώς</option>
                          <option value="MoneyGram">MoneyGram</option>
                          <option value="Western Union">Western Union</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Ημερομηνία Πληρωμής *</label>
                        <div className="h-[52px]">
                          <DatePicker
                            value={advancePaymentDate}
                            onChange={(date) => setAdvancePaymentDate(date)}
                            placeholder=""
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Remaining Balance Display - Only show when advance payment entered */}
                  {advancePayment && parseFloat(advancePayment) > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-700">Υπόλοιπο:</span>
                        <span className="text-2xl font-bold text-amber-600">
                          €{Number(remainingBalance).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : priceCalculation && !priceCalculation.success && priceCalculation.missingDates && priceCalculation.missingDates.length > 0 ? (
                /* Error: Missing Prices */
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-bold mb-1">
                    ❌ Δεν υπάρχουν τιμές για όλες τις ημερομηνίες!
                  </p>
                  <p className="text-sm text-red-600 mb-2">
                    Παρακαλώ ορίστε τιμές στον τιμοκατάλογο πρώτα.
                  </p>
                  <ul className="text-xs text-red-600 list-disc list-inside">
                    {priceCalculation.missingDates.map((date, idx) => (
                      <li key={idx}>{date}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}

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
                disabled={dateConflicts.length > 0}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-opacity shadow-md ${
                  dateConflicts.length > 0
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:opacity-90'
                }`}
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
                disabled={dateConflicts.length > 0}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-opacity shadow-md ${
                  dateConflicts.length > 0
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:opacity-90'
                }`}
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
