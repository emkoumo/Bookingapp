'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Toast from '@/components/Toast'
import { UserButton } from '@clerk/nextjs'

type Step = 1 | 2 | 3

export default function NewHotelWizard() {
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const router = useRouter()

  // Step 1
  const [hotelName, setHotelName] = useState('')
  const [hotelEmail, setHotelEmail] = useState('')
  const [hotelId, setHotelId] = useState<string | null>(null)

  // Step 2
  const [propertyNames, setPropertyNames] = useState<string[]>([''])

  const updateProperty = (i: number, value: string) => {
    setPropertyNames(prev => prev.map((p, idx) => (idx === i ? value : p)))
  }
  const addProperty = () => setPropertyNames(prev => [...prev, ''])
  const removeProperty = (i: number) =>
    setPropertyNames(prev => prev.filter((_, idx) => idx !== i))

  const submitStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hotelName.trim() || !hotelEmail.trim()) {
      setToast({ message: 'Συμπληρώστε όλα τα πεδία', type: 'warning' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hotelName.trim(), email: hotelEmail.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
      const business = await res.json()
      setHotelId(business.id)
      localStorage.setItem('selectedBusiness', business.id)
      setStep(2)
    } catch (err) {
      setToast({ message: (err as Error).message || 'Σφάλμα', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const submitStep2 = async () => {
    if (!hotelId) return
    const valid = propertyNames.map(p => p.trim()).filter(p => p.length > 0)
    if (valid.length === 0) {
      // Allow skipping
      setStep(3)
      setTimeout(() => router.push('/'), 800)
      return
    }
    setSubmitting(true)
    try {
      for (const name of valid) {
        const res = await fetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId: hotelId, name }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Failed to create "${name}"`)
        }
      }
      setStep(3)
      setTimeout(() => router.push('/'), 1000)
    } catch (err) {
      setToast({ message: (err as Error).message || 'Σφάλμα', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="absolute top-3 right-4 z-10">
        <UserButton afterSignOutUrl="/sign-in" />
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-5 md:mb-7">
            <div className="inline-flex bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-16 h-16 rounded-2xl items-center justify-center text-3xl font-bold shadow-lg mb-3">
              {step === 1 ? '🏨' : step === 2 ? '🛏️' : '🎉'}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {step === 1 ? 'Καλώς Ήρθατε!' : step === 2 ? 'Προσθέστε δωμάτια' : 'Έτοιμο!'}
            </h1>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              {step === 1 && 'Ας δημιουργήσουμε το πρώτο σας κατάλυμα'}
              {step === 2 && 'Διαμερίσματα, βίλες, δωμάτια — ό,τι ενοικιάζετε'}
              {step === 3 && 'Καλωσήρθατε στο Booking App'}
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className={`h-2 rounded-full transition-all ${
                  n === step ? 'w-8 bg-blue-500' : n < step ? 'w-2 bg-blue-500' : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          {step === 1 && (
            <form
              onSubmit={submitStep1}
              className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg p-5 md:p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Όνομα Καταλύματος
                </label>
                <input
                  type="text"
                  value={hotelName}
                  onChange={e => setHotelName(e.target.value)}
                  placeholder="π.χ. Villa Sunrise"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Επικοινωνίας
                </label>
                <input
                  type="email"
                  value={hotelEmail}
                  onChange={e => setHotelEmail(e.target.value)}
                  placeholder="info@example.com"
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {submitting ? 'Δημιουργία...' : 'Συνέχεια'}
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg p-5 md:p-6 space-y-4">
              <div className="space-y-2">
                {propertyNames.map((name, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={e => updateProperty(i, e.target.value)}
                      placeholder={`π.χ. ${i === 0 ? 'Διαμέρισμα 1' : 'Villa ' + (i + 1)}`}
                      className="flex-1 min-w-0 px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    {propertyNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProperty(i)}
                        className="px-3 py-2 bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors flex-shrink-0"
                        aria-label="Αφαίρεση"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addProperty}
                className="w-full px-3 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm font-medium"
              >
                + Προσθήκη ακόμα ενός
              </button>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={submitStep2}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {submitting ? 'Αποθήκευση...' : 'Ολοκλήρωση'}
                </button>
              </div>
              <p className="text-xs text-gray-500 text-center">
                Μπορείτε να τα προσθέσετε και αργότερα από τη διαχείριση
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-lg p-6 md:p-8 text-center">
              <div className="text-5xl mb-3">✓</div>
              <p className="text-gray-700 font-medium">Όλα έτοιμα!</p>
              <p className="text-sm text-gray-500 mt-1">Σας μεταφέρουμε στην εφαρμογή...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
