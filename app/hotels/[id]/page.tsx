'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import Modal from '@/components/Modal'

interface Business {
  id: string
  name: string
  email: string
}

interface Property {
  id: string
  name: string
  description: string | null
  icalUrl?: string | null
}

export default function HotelDetailPage() {
  const params = useParams<{ id: string }>()
  const businessId = params.id
  const router = useRouter()

  const [business, setBusiness] = useState<Business | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)

  const [editingHotel, setEditingHotel] = useState(false)
  const [hotelName, setHotelName] = useState('')
  const [hotelEmail, setHotelEmail] = useState('')

  const [showPropertyForm, setShowPropertyForm] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [propName, setPropName] = useState('')
  const [propDescription, setPropDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [deletingPropertyId, setDeletingPropertyId] = useState<string | null>(null)

  useEffect(() => {
    if (businessId) load()
  }, [businessId])

  const load = async () => {
    setLoading(true)
    try {
      const [bRes, pRes] = await Promise.all([
        fetch(`/api/businesses/${businessId}`),
        fetch(`/api/properties?businessId=${businessId}`),
      ])
      if (!bRes.ok) {
        if (bRes.status === 403 || bRes.status === 404) {
          setToast({ message: 'Δεν έχετε πρόσβαση', type: 'error' })
          setTimeout(() => router.push('/hotels'), 800)
        }
        return
      }
      const bData = await bRes.json()
      setBusiness(bData)
      setHotelName(bData.name)
      setHotelEmail(bData.email)
      if (pRes.ok) setProperties(await pRes.json())
    } finally {
      setLoading(false)
    }
  }

  const saveHotel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hotelName.trim() || !hotelEmail.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/businesses/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: hotelName.trim(), email: hotelEmail.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      setToast({ message: 'Αποθηκεύτηκε', type: 'success' })
      setEditingHotel(false)
      load()
    } catch {
      setToast({ message: 'Σφάλμα', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateProperty = () => {
    setEditingProperty(null)
    setPropName('')
    setPropDescription('')
    setShowPropertyForm(true)
  }

  const openEditProperty = (p: Property) => {
    setEditingProperty(p)
    setPropName(p.name)
    setPropDescription(p.description || '')
    setShowPropertyForm(true)
  }

  const closePropertyForm = () => {
    setShowPropertyForm(false)
    setEditingProperty(null)
    setPropName('')
    setPropDescription('')
  }

  const submitProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!propName.trim()) {
      setToast({ message: 'Συμπληρώστε όνομα', type: 'warning' })
      return
    }
    setSubmitting(true)
    try {
      const url = editingProperty ? `/api/properties/${editingProperty.id}` : '/api/properties'
      const method = editingProperty ? 'PATCH' : 'POST'
      const body = editingProperty
        ? { name: propName.trim(), description: propDescription.trim() }
        : { businessId, name: propName.trim(), description: propDescription.trim() }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
      setToast({ message: editingProperty ? 'Αποθηκεύτηκε' : 'Δημιουργήθηκε', type: 'success' })
      closePropertyForm()
      load()
    } catch (err) {
      setToast({ message: (err as Error).message || 'Σφάλμα', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDeleteProperty = async () => {
    if (!deletingPropertyId) return
    try {
      const res = await fetch(`/api/properties/${deletingPropertyId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setToast({ message: 'Διαγράφηκε', type: 'success' })
      setDeletingPropertyId(null)
      load()
    } catch {
      setToast({ message: 'Σφάλμα διαγραφής', type: 'error' })
      setDeletingPropertyId(null)
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-xl text-gray-700">Φόρτωση...</div>
        </div>
      </>
    )
  }

  if (!business) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-gray-600">Δεν βρέθηκε</div>
        </div>
      </>
    )
  }

  const openInApp = (path: string) => {
    localStorage.setItem('selectedBusiness', business.id)
    router.push(`${path}?business=${business.id}`)
  }

  return (
    <>
      <Header />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Back */}
          <button
            onClick={() => router.push('/hotels')}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-4 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Πίσω στα Καταλύματα
          </button>

          {/* Hotel info card */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl shadow-md p-5 md:p-6 mb-4 md:mb-6">
            {editingHotel ? (
              <form onSubmit={saveHotel} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Όνομα</label>
                  <input
                    type="text"
                    value={hotelName}
                    onChange={e => setHotelName(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={hotelEmail}
                    onChange={e => setHotelEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {submitting ? 'Αποθήκευση...' : 'Αποθήκευση'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingHotel(false)
                      setHotelName(business.name)
                      setHotelEmail(business.email)
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium"
                  >
                    Ακύρωση
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-start gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-2xl shadow-md flex-shrink-0">
                  🏨
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{business.name}</h1>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{business.email}</p>
                </div>
                <button
                  onClick={() => setEditingHotel(true)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium flex-shrink-0"
                >
                  Επεξεργασία
                </button>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-6">
            <button
              onClick={() => openInApp('/calendar')}
              className="bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl p-3 md:p-4 text-center shadow-sm hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-1">📅</div>
              <div className="text-sm font-medium text-gray-800">Ημερολόγιο</div>
            </button>
            <button
              onClick={() => openInApp('/bookings')}
              className="bg-white border-2 border-gray-200 hover:border-green-300 rounded-xl p-3 md:p-4 text-center shadow-sm hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-1">📋</div>
              <div className="text-sm font-medium text-gray-800">Κρατήσεις</div>
            </button>
            <button
              onClick={() => openInApp('/reports')}
              className="bg-white border-2 border-gray-200 hover:border-purple-300 rounded-xl p-3 md:p-4 text-center shadow-sm hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-1">📊</div>
              <div className="text-sm font-medium text-gray-800">Αναφορές</div>
            </button>
            <button
              onClick={() => openInApp('/templates')}
              className="bg-white border-2 border-gray-200 hover:border-orange-300 rounded-xl p-3 md:p-4 text-center shadow-sm hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-1">✉️</div>
              <div className="text-sm font-medium text-gray-800">Email</div>
            </button>
          </div>

          {/* Properties section */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">
              Δωμάτια / Διαμερίσματα ({properties.length})
            </h2>
            <button
              onClick={openCreateProperty}
              className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 transition-all flex items-center gap-1.5 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Νέο
            </button>
          </div>

          {properties.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-2">🛏️</div>
              <p className="text-gray-700 font-medium mb-1">Δεν υπάρχουν ακόμα δωμάτια</p>
              <p className="text-sm text-gray-500 mb-4">
                Προσθέστε τα διαμερίσματα, βίλες ή δωμάτια του καταλύματος
              </p>
              <button
                onClick={openCreateProperty}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700"
              >
                Προσθήκη πρώτου δωματίου
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {properties.map(p => (
                <div
                  key={p.id}
                  className="bg-white border-2 border-gray-200 rounded-2xl p-4 md:p-5 shadow-md hover:shadow-lg hover:border-blue-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-gray-800 truncate">{p.name}</h3>
                    <div className="text-2xl flex-shrink-0">🛏️</div>
                  </div>
                  {p.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => openEditProperty(p)}
                      className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium"
                    >
                      Επεξεργασία
                    </button>
                    <button
                      onClick={() => setDeletingPropertyId(p.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium"
                    >
                      Διαγραφή
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Property form modal */}
      {showPropertyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-5 md:p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingProperty ? 'Επεξεργασία Δωματίου' : 'Νέο Δωμάτιο'}
              </h3>
            </div>
            <form onSubmit={submitProperty}>
              <div className="p-5 md:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Όνομα</label>
                  <input
                    type="text"
                    value={propName}
                    onChange={e => setPropName(e.target.value)}
                    placeholder="π.χ. Διαμέρισμα 1, Villa Sunrise"
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Περιγραφή (προαιρετικά)
                  </label>
                  <textarea
                    value={propDescription}
                    onChange={e => setPropDescription(e.target.value)}
                    rows={3}
                    placeholder="π.χ. 2 υπνοδωμάτια, μπαλκόνι, θέα στη θάλασσα"
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
              <div className="p-5 md:p-6 bg-gray-50 rounded-b-2xl flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closePropertyForm}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Αποθήκευση...' : editingProperty ? 'Αποθήκευση' : 'Δημιουργία'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingPropertyId && (
        <Modal
          type="danger"
          title="Διαγραφή Δωματίου"
          message="Όλες οι κρατήσεις, διαθεσιμότητες και τιμές αυτού του δωματίου θα διαγραφούν οριστικά."
          confirmText="Διαγραφή"
          cancelText="Ακύρωση"
          onConfirm={confirmDeleteProperty}
          onCancel={() => setDeletingPropertyId(null)}
        />
      )}
    </>
  )
}
