'use client'

import { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns'
import { el } from 'date-fns/locale'

interface DatePickerProps {
  value: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
  disabledDates?: string[] // Array of dates in 'yyyy-MM-dd' format that should be disabled
  isEditMode?: boolean // If true, don't disable any dates
}

export default function DatePicker({ value, onChange, placeholder = 'Επιλέξτε ημερομηνία', className = '', disabledDates = [], isEditMode = false }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date())
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedDate = value ? new Date(value) : null

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, isMobile])

  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    // Don't allow selecting disabled dates in create mode
    if (!isEditMode && disabledDates.includes(dateStr)) {
      return
    }
    onChange(dateStr)
    setIsOpen(false)
  }

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    onChange(format(today, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  const days = getDaysInMonth()
  const weekDays = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ']

  return (
    <div ref={containerRef} className="relative">
      {/* Input Field */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm text-left flex items-center justify-between bg-white hover:border-gray-400 transition-colors ${className}`}
      >
        <span className={selectedDate ? 'text-gray-900' : 'text-gray-500'}>
          {selectedDate ? format(selectedDate, 'd MMM yyyy', { locale: el }) : placeholder}
        </span>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Calendar Dropdown */}
      {isOpen && (
        <>
          {isMobile ? (
            /* Mobile: Full-screen modal */
            <div className="fixed inset-0 z-[80] bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-4 rounded-t-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h3 className="text-xl font-bold">
                      {format(currentMonth, 'MMMM yyyy', { locale: el })}
                    </h3>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="p-4">
                  {/* Week Days */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day) => (
                      <div key={day} className="text-center text-xs font-bold text-gray-600 py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Days */}
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => {
                      const isSelected = selectedDate && isSameDay(day, selectedDate)
                      const isToday = isSameDay(day, new Date())
                      const isCurrentMonth = isSameMonth(day, currentMonth)
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const isDisabled = !isEditMode && disabledDates.includes(dateStr)

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleDateClick(day)}
                          disabled={isDisabled}
                          className={`
                            aspect-square p-2 text-sm rounded-lg font-medium transition-all
                            ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                            ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md scale-110' : ''}
                            ${isToday && !isSelected ? 'border-2 border-blue-600 text-blue-600 font-bold' : ''}
                            ${!isSelected && isCurrentMonth && !isDisabled ? 'hover:bg-blue-50 active:bg-blue-100' : ''}
                            ${isDisabled ? 'bg-red-100 text-red-400 line-through cursor-not-allowed opacity-60' : ''}
                          `}
                        >
                          {format(day, 'd')}
                        </button>
                      )
                    })}
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="flex-1 py-3 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm transition-colors"
                    >
                      Ακύρωση
                    </button>
                    <button
                      type="button"
                      onClick={handleToday}
                      className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm transition-colors"
                    >
                      Σήμερα
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop: Dropdown */
            <div className="absolute z-50 mt-2 bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden w-80" style={{ left: 'auto', right: 'auto' }}>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h3 className="text-lg font-bold">
                    {format(currentMonth, 'MMMM yyyy', { locale: el })}
                  </h3>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="p-4">
                {/* Week Days */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDays.map((day) => (
                    <div key={day} className="text-center text-xs font-bold text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, index) => {
                    const isSelected = selectedDate && isSameDay(day, selectedDate)
                    const isToday = isSameDay(day, new Date())
                    const isCurrentMonth = isSameMonth(day, currentMonth)
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const isDisabled = !isEditMode && disabledDates.includes(dateStr)

                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleDateClick(day)}
                        disabled={isDisabled}
                        className={`
                          aspect-square p-2 text-sm rounded-lg font-medium transition-all
                          ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                          ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : ''}
                          ${isToday && !isSelected ? 'border-2 border-blue-600 text-blue-600 font-bold' : ''}
                          ${!isSelected && isCurrentMonth && !isDisabled ? 'hover:bg-blue-50' : ''}
                          ${isDisabled ? 'bg-red-100 text-red-400 line-through cursor-not-allowed opacity-60' : ''}
                        `}
                      >
                        {format(day, 'd')}
                      </button>
                    )
                  })}
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleToday}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm transition-colors"
                  >
                    Σήμερα
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
