'use client'

import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, isSameDay, getDay } from 'date-fns'
import { el } from 'date-fns/locale'

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
  property: Property
}

interface ScrollableCalendarProps {
  bookings: Booking[]
  properties: Property[]
  selectedProperty: string
  onBookingClick: (booking: Booking) => void
  getColorForProperty: (propertyId: string) => string
  dateRangeStart?: string
  dateRangeEnd?: string
}

export default function ScrollableCalendar({
  bookings,
  properties,
  selectedProperty,
  onBookingClick,
  getColorForProperty,
  dateRangeStart,
  dateRangeEnd,
}: ScrollableCalendarProps) {
  // Generate months based on date range or default to 12 months
  const today = new Date()
  let months: Date[] = []

  if (dateRangeStart || dateRangeEnd) {
    // If date range is provided (YYYY-MM format), generate months within that range
    const startDate = dateRangeStart ? new Date(`${dateRangeStart}-01`) : startOfMonth(today)
    const endDate = dateRangeEnd ? new Date(`${dateRangeEnd}-01`) : addMonths(today, 11)

    let currentMonth = startOfMonth(startDate)
    const lastMonth = startOfMonth(endDate)

    while (currentMonth <= lastMonth) {
      months.push(new Date(currentMonth))
      currentMonth = addMonths(currentMonth, 1)
    }
  } else {
    // Default: Generate 12 months starting from current month
    months = Array.from({ length: 12 }, (_, i) => addMonths(today, i))
  }

  const activeBookings = bookings.filter((b) => b.status === 'active')

  // Filter properties based on selection
  const displayProperties = selectedProperty === 'all'
    ? properties
    : properties.filter(p => p.id === selectedProperty)

  const getDaysInMonth = (date: Date) => {
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    return eachDayOfInterval({ start, end })
  }

  const isDateBooked = (date: Date, propertyId: string) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return activeBookings.some((booking) => {
      if (booking.property.id !== propertyId) return false
      const checkIn = new Date(booking.checkIn)
      const checkOut = new Date(booking.checkOut)
      const currentDate = new Date(dateStr)
      return currentDate >= checkIn && currentDate <= checkOut
    })
  }

  const getBookingForDate = (date: Date, propertyId: string) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return activeBookings.find((booking) => {
      if (booking.property.id !== propertyId) return false
      const checkIn = new Date(booking.checkIn)
      const checkOut = new Date(booking.checkOut)
      const currentDate = new Date(dateStr)
      return currentDate >= checkIn && currentDate <= checkOut
    })
  }

  const isFirstDayOfBooking = (date: Date, propertyId: string) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return activeBookings.some((booking) => {
      if (booking.property.id !== propertyId) return false
      return format(new Date(booking.checkIn), 'yyyy-MM-dd') === dateStr
    })
  }

  const isChangeoverDay = (date: Date, propertyId: string) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const hasCheckOut = activeBookings.some((booking) => {
      if (booking.property.id !== propertyId) return false
      return format(new Date(booking.checkOut), 'yyyy-MM-dd') === dateStr
    })
    const hasCheckIn = activeBookings.some((booking) => {
      if (booking.property.id !== propertyId) return false
      return format(new Date(booking.checkIn), 'yyyy-MM-dd') === dateStr
    })
    return hasCheckOut && hasCheckIn
  }

  const weekDays = ['Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ', 'Κ']

  // If only 1 property selected, show months in grid
  if (displayProperties.length === 1) {
    const property = displayProperties[0]
    return (
      <div className="px-1 md:px-4 py-4 md:py-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
          {months.map((monthDate, monthIndex) => {
            const days = getDaysInMonth(monthDate)
            const firstDayOfWeek = getDay(days[0])
            const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

            return (
              <div key={monthIndex} className="border border-gray-200 rounded-lg p-1.5 md:p-3 space-y-1 md:space-y-2" style={{ backgroundColor: '#f9f9f9' }}>
                {/* Month Title */}
                <div className="text-center border-b border-gray-200 pb-1 md:pb-2">
                  <h3 className="font-medium text-xs md:text-base text-gray-900">
                    {format(monthDate, 'MMMM yyyy', { locale: el })}
                  </h3>
                </div>

                {/* Week Day Headers */}
                <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-0.5 md:mb-1">
                  {weekDays.map((day, i) => (
                    <div
                      key={i}
                      className="text-center py-0.5 md:py-1 text-[9px] md:text-xs font-semibold text-gray-500 uppercase"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                  {/* Empty cells for padding */}
                  {Array.from({ length: startPadding }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {/* Actual days */}
                  {days.map((day, dayIndex) => {
                    const isToday = isSameDay(day, today)
                    const isBooked = isDateBooked(day, property.id)
                    const booking = getBookingForDate(day, property.id)
                    const isChangeover = isChangeoverDay(day, property.id)
                    const isFirstDay = isFirstDayOfBooking(day, property.id)

                    return (
                      <div
                        key={dayIndex}
                        onClick={() => booking && onBookingClick(booking)}
                        style={{
                          backgroundColor: isBooked
                            ? (isFirstDay && !isChangeover ? '#2d8a6e' : '#40af90')
                            : '#f9f9f9'
                        }}
                        className={`
                          relative aspect-square flex flex-col items-center justify-center
                          rounded text-[11px] md:text-sm font-medium
                          transition-all duration-200
                          ${isBooked
                            ? 'text-white cursor-pointer shadow-sm'
                            : 'hover:bg-gray-100'
                          }
                          ${isToday && !isBooked ? 'ring-2 ring-blue-500' : ''}
                          ${isChangeover ? 'ring-2 ring-orange-400' : ''}
                          ${isFirstDay && booking && !isChangeover ? 'ring-1 ring-[#333]' : ''}
                        `}
                      >
                        <div className={`font-semibold ${isBooked ? '' : 'text-[#333]'}`}>
                          {format(day, 'd')}
                        </div>
                        {isChangeover && (
                          <div className="absolute top-0 right-0 w-1.5 h-1.5 md:w-2 md:h-2 bg-orange-400 rounded-full" />
                        )}
                        {booking && isFirstDay && !isChangeover && (
                          <div className="text-[7px] md:text-[10px] leading-tight truncate w-full px-0.5 opacity-90 text-center">
                            {booking.customerName.split(' ')[0]}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Multi-property view (original layout)
  return (
    <div className="px-1 md:px-4 py-4 md:py-6 space-y-8 md:space-y-10">
      {months.map((monthDate, monthIndex) => {
        const days = getDaysInMonth(monthDate)
        const firstDayOfWeek = getDay(days[0])
        const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

        return (
          <div key={monthIndex} className="space-y-3 md:space-y-4">
            {/* Month Title */}
            <div className="text-center">
              <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                {format(monthDate, 'MMMM yyyy', { locale: el })}
              </h2>
            </div>

            {/* Multi-Property Grid - 2 cols on mobile, 4 on desktop */}
            <div className={`grid gap-2 md:gap-6 ${
              displayProperties.length === 2 ? 'grid-cols-2' :
              displayProperties.length === 3 ? 'grid-cols-2 lg:grid-cols-3' :
              'grid-cols-2 lg:grid-cols-4'
            }`}>
              {displayProperties.map((property) => (
                <div key={property.id} className="border border-gray-200 rounded-lg p-1.5 md:p-3 space-y-1 md:space-y-2" style={{ backgroundColor: '#f9f9f9' }}>
                  {/* Property Name */}
                  <div className="text-center border-b border-gray-200 pb-1 md:pb-2">
                    <h3 className="font-medium text-xs md:text-base text-gray-900">
                      {property.name}
                    </h3>
                  </div>

                  {/* Week Day Headers */}
                  <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-0.5 md:mb-1">
                    {weekDays.map((day, i) => (
                      <div
                        key={i}
                        className="text-center py-0.5 md:py-1 text-[9px] md:text-xs font-semibold text-gray-500 uppercase"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days - Open grid, no container */}
                  <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                    {/* Empty cells for padding */}
                    {Array.from({ length: startPadding }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {/* Actual days */}
                    {days.map((day, dayIndex) => {
                      const isToday = isSameDay(day, today)
                      const isBooked = isDateBooked(day, property.id)
                      const booking = getBookingForDate(day, property.id)
                      const isChangeover = isChangeoverDay(day, property.id)
                      const isFirstDay = isFirstDayOfBooking(day, property.id)

                      return (
                        <div
                          key={dayIndex}
                          onClick={() => booking && onBookingClick(booking)}
                          style={{
                            backgroundColor: isBooked
                              ? (isFirstDay && !isChangeover ? '#2d8a6e' : '#40af90')
                              : '#f9f9f9'
                          }}
                          className={`
                            relative aspect-square flex flex-col items-center justify-center
                            rounded text-[11px] md:text-sm font-medium
                            transition-all duration-200
                            ${isBooked
                              ? 'text-white cursor-pointer shadow-sm'
                              : 'hover:bg-gray-100'
                            }
                            ${isToday && !isBooked ? 'ring-2 ring-blue-500' : ''}
                            ${isChangeover ? 'ring-2 ring-orange-400' : ''}
                            ${isFirstDay && booking && !isChangeover ? 'ring-1 ring-[#333]' : ''}
                          `}
                        >
                          <div className={`font-semibold ${isBooked ? '' : 'text-[#333]'}`}>
                            {format(day, 'd')}
                          </div>
                          {isChangeover && (
                            <div className="absolute top-0 right-0 w-1.5 h-1.5 md:w-2 md:h-2 bg-orange-400 rounded-full" />
                          )}
                          {booking && isFirstDay && !isChangeover && (
                            <div className="text-[7px] md:text-[10px] leading-tight truncate w-full px-0.5 opacity-90 text-center">
                              {booking.customerName.split(' ')[0]}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
