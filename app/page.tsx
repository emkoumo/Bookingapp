'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import { resolveYear } from '@/lib/year'

export default function Home() {
  const [selectedBusiness, setSelectedBusiness] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Get selected business from localStorage
    const savedBusiness = localStorage.getItem('selectedBusiness')
    if (savedBusiness) {
      setSelectedBusiness(savedBusiness)
    }
    setLoading(false)
  }, [])

  const navigateTo = (path: string) => {
    const business = localStorage.getItem('selectedBusiness')
    if (!business) {
      setToast({ message: 'Παρακαλώ επιλέξτε επιχείρηση από το μενού πάνω δεξιά', type: 'warning' })
      return
    }
    // Carry the season through, so every page opens on the same year.
    const year = resolveYear(null)
    router.push(`${path}?business=${business}&year=${year}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-700">Φόρτωση...</div>
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Καλώς Ήρθατε</h1>
            <p className="text-gray-600">Επιλέξτε μια κατηγορία για να ξεκινήσετε</p>
          </div>

          {/* Quick quote — first thing you reach for when the phone rings, so it
              sits above the rest and spans the width. */}
          <button
            onClick={() => navigateTo('/quote')}
            className="w-full mb-3 md:mb-6 group bg-white hover:bg-gradient-to-br hover:from-teal-50 hover:to-teal-100 border-2 border-gray-200 hover:border-teal-400 p-4 md:p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 flex items-center gap-4"
          >
            <svg className="w-10 h-10 md:w-12 md:h-12 text-gray-400 group-hover:text-teal-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <div className="text-left min-w-0">
              <h2 className="text-base md:text-xl font-bold text-gray-800 group-hover:text-teal-700 transition-colors">
                Γρήγορη Προσφορά
              </h2>
              <p className="text-xs md:text-sm text-gray-500 group-hover:text-gray-600">
                Διαθεσιμότητα &amp; τιμές για τηλέφωνο ή μήνυμα
              </p>
            </div>
          </button>

          {/* Navigation Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <button
              onClick={() => navigateTo('/calendar')}
              className="group bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-blue-100 border-2 border-gray-200 hover:border-blue-400 p-4 md:p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <div className="flex justify-center mb-3 md:mb-4">
                <svg className="w-12 h-12 md:w-16 md:h-16 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-base md:text-xl font-bold text-gray-800 group-hover:text-blue-600 mb-1 md:mb-2 transition-colors">Ημερολόγιο</h2>
              <p className="text-xs md:text-sm text-gray-500 group-hover:text-gray-600">Προβολή κρατήσεων</p>
            </button>

            <button
              onClick={() => navigateTo('/bookings')}
              className="group bg-white hover:bg-gradient-to-br hover:from-green-50 hover:to-green-100 border-2 border-gray-200 hover:border-green-400 p-4 md:p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <div className="flex justify-center mb-3 md:mb-4">
                <svg className="w-12 h-12 md:w-16 md:h-16 text-gray-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="text-base md:text-xl font-bold text-gray-800 group-hover:text-green-600 mb-1 md:mb-2 transition-colors">Κρατήσεις</h2>
              <p className="text-xs md:text-sm text-gray-500 group-hover:text-gray-600">Λίστα & διαχείριση</p>
            </button>

            <button
              onClick={() => navigateTo('/reports')}
              className="group bg-white hover:bg-gradient-to-br hover:from-purple-50 hover:to-purple-100 border-2 border-gray-200 hover:border-purple-400 p-4 md:p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <div className="flex justify-center mb-3 md:mb-4">
                <svg className="w-12 h-12 md:w-16 md:h-16 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-base md:text-xl font-bold text-gray-800 group-hover:text-purple-600 mb-1 md:mb-2 transition-colors">Αναφορές</h2>
              <p className="text-xs md:text-sm text-gray-500 group-hover:text-gray-600">Στατιστικά & εξαγωγές</p>
            </button>

            <button
              onClick={() => navigateTo('/templates')}
              className="group bg-white hover:bg-gradient-to-br hover:from-orange-50 hover:to-orange-100 border-2 border-gray-200 hover:border-orange-400 p-4 md:p-8 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <div className="flex justify-center mb-3 md:mb-4">
                <svg className="w-12 h-12 md:w-16 md:h-16 text-gray-400 group-hover:text-orange-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-base md:text-xl font-bold text-gray-800 group-hover:text-orange-600 mb-1 md:mb-2 transition-colors">Email</h2>
              <p className="text-xs md:text-sm text-gray-500 group-hover:text-gray-600">Διαχείριση προτύπων</p>
            </button>
          </div>

          {!selectedBusiness && (
            <div className="mt-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="text-3xl">👆</div>
                <div>
                  <p className="text-blue-900 font-semibold">Επιλέξτε επιχείρηση</p>
                  <p className="text-blue-700 text-sm mt-1">
                    Χρησιμοποιήστε το μενού πάνω δεξιά για να επιλέξετε επιχείρηση
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
