'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import FinancialManagementModal from './FinancialManagementModal'

interface Business {
  id: string
  name: string
  email: string
}

export default function Header() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<string>('')
  const [isOpen, setIsOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    fetchBusinesses()
    fetch('/api/me')
      .then(r => (r.ok ? r.json() : null))
      .then(me => setIsAdmin(me?.role === 'admin'))
      .catch(() => {})
  }, [])

  const fetchBusinesses = async () => {
    try {
      const res = await fetch('/api/businesses')
      if (!res.ok) return
      const data = await res.json()
      setBusinesses(data)

      const savedBusiness = localStorage.getItem('selectedBusiness')
      if (savedBusiness && data.find((b: Business) => b.id === savedBusiness)) {
        setSelectedBusiness(savedBusiness)
      } else if (data.length > 0) {
        setSelectedBusiness(data[0].id)
        localStorage.setItem('selectedBusiness', data[0].id)
      } else {
        setSelectedBusiness('')
        localStorage.removeItem('selectedBusiness')
      }
    } catch (error) {
      console.error('Error fetching businesses:', error)
    }
  }

  const handleBusinessChange = (businessId: string) => {
    setSelectedBusiness(businessId)
    localStorage.setItem('selectedBusiness', businessId)
    setIsOpen(false)

    if (pathname !== '/') {
      const url = new URL(window.location.href)
      url.searchParams.set('business', businessId)
      window.location.href = url.toString()
    }
  }

  const getSelectedBusinessName = () => {
    const business = businesses.find(b => b.id === selectedBusiness)
    if (!business) return 'Επιλέξτε'
    const firstWord = business.name.split(' ')[0]
    return firstWord.length > 14 ? firstWord.slice(0, 14) + '…' : firstWord
  }

  return (
    <header className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div
          onClick={() => router.push('/')}
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="hidden md:flex bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-10 h-10 rounded-lg items-center justify-center text-xl font-bold shadow-lg">
            📅
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 leading-tight">Booking App</h1>
            <p className="text-xs text-gray-500 hidden md:block">Διαχείριση Κρατήσεων</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Payment Settings Button */}
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Μέθοδοι Πληρωμής"
            disabled={!selectedBusiness}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </button>

          {/* Business Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1.5 px-2.5 py-2 md:px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
              <span className="font-medium text-sm">
                {getSelectedBusinessName()}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20 max-h-[70vh] overflow-y-auto">
                  {businesses.map((business) => (
                    <button
                      key={business.id}
                      onClick={() => handleBusinessChange(business.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${
                        selectedBusiness === business.id
                          ? 'bg-blue-50 border-l-4 border-blue-500'
                          : ''
                      }`}
                    >
                      <div className="font-semibold text-gray-800">
                        {business.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {business.email}
                      </div>
                      {selectedBusiness === business.id && (
                        <div className="text-xs text-blue-600 font-medium mt-1">
                          ✓ Ενεργή
                        </div>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setIsOpen(false)
                      router.push('/hotels')
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-t border-gray-100 text-blue-600 font-medium text-sm"
                  >
                    + Διαχείριση Καταλυμάτων
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        router.push('/admin')
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors text-purple-600 font-medium text-sm"
                    >
                      🔒 Διαχείριση Χρηστών
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* User menu */}
          <div className="ml-1">
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{ elements: { avatarBox: 'w-8 h-8' } }}
            />
          </div>
        </div>
      </div>

      {/* Payment Settings Modal */}
      {selectedBusiness && (
        <FinancialManagementModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          businessId={selectedBusiness}
        />
      )}
    </header>
  )
}
