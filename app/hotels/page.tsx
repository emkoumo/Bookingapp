'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import Modal from '@/components/Modal'

interface Business {
  id: string
  name: string
  email: string
  createdAt: string
}

export default function HotelsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Business | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchBusinesses()
  }, [])

  const fetchBusinesses = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/businesses')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setBusinesses(data)
      if (data.length === 0) {
        router.push('/hotels/new')
        return
      }
    } catch {
      setToast({ message: 'Σφάλμα φόρτωσης', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setName('')
    setEmail('')
    setShowForm(true)
  }

  const openEdit = (b: Business) => {
    setEditing(b)
    setName(b.name)
    setEmail(b.email)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setName('')
    setEmail('')
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setToast({ message: 'Συμπληρώστε όλα τα πεδία', type: 'warning' })
      return
    }
    setSubmitting(true)
    try {
      const url = editing ? `/api/businesses/${editing.id}` : '/api/businesses'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
      setToast({ message: editing ? 'Αποθηκεύτηκε' : 'Δημιουργήθηκε', type: 'success' })
      closeForm()
      fetchBusinesses()
    } catch (err) {
      setToast({ message: (err as Error).message || 'Σφάλμα', type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/businesses/${deletingId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setToast({ message: 'Διαγράφηκε', type: 'success' })
      setDeletingId(null)
      fetchBusinesses()
    } catch {
      setToast({ message: 'Σφάλμα διαγραφής', type: 'error' })
      setDeletingId(null)
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

  return (
    <>
      <Header />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Τα Καταλύματά μου</h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">
                Διαχείριση των επιχειρήσεών σας
              </p>
            </div>
            <button
              onClick={openCreate}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg shadow-md hover:from-blue-600 hover:to-indigo-700 hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Νέο Κατάλυμα
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {businesses.map(b => (
              <div
                key={b.id}
                className="bg-white border-2 border-gray-200 rounded-2xl p-5 md:p-6 shadow-md hover:shadow-lg hover:border-blue-300 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg md:text-xl font-bold text-gray-800 truncate">{b.name}</h2>
                    <p className="text-sm text-gray-500 mt-1 truncate">{b.email}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shadow-md flex-shrink-0">
                    🏨
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      localStorage.setItem('selectedBusiness', b.id)
                      router.push('/')
                    }}
                    className="flex-1 min-w-[100px] px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium rounded-lg transition-colors text-sm"
                  >
                    Άνοιγμα
                  </button>
                  <button
                    onClick={() => router.push(`/hotels/${b.id}`)}
                    className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium rounded-lg transition-colors text-sm"
                  >
                    Διαχείριση
                  </button>
                  <button
                    onClick={() => setDeletingId(b.id)}
                    className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-medium rounded-lg transition-colors text-sm"
                  >
                    Διαγραφή
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-5 md:p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editing ? 'Επεξεργασία Καταλύματος' : 'Νέο Κατάλυμα'}
              </h3>
            </div>
            <form onSubmit={submitForm}>
              <div className="p-5 md:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Όνομα</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="π.χ. Villa Sunrise"
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="info@example.com"
                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div className="p-5 md:p-6 bg-gray-50 rounded-b-2xl flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Αποθήκευση...' : editing ? 'Αποθήκευση' : 'Δημιουργία'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingId && (
        <Modal
          type="danger"
          title="Διαγραφή Καταλύματος"
          message="Είστε βέβαιοι; Όλες οι κρατήσεις, διαθεσιμότητες, πρότυπα και ρυθμίσεις πληρωμών αυτού του καταλύματος θα διαγραφούν οριστικά."
          confirmText="Διαγραφή"
          cancelText="Ακύρωση"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </>
  )
}
