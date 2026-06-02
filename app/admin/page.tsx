'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import Modal from '@/components/Modal'

interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
  imageUrl: string | null
  memberships: {
    id: string
    role: string
    business: { id: string; name: string }
  }[]
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [meId, setMeId] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    ;(async () => {
      try {
        const meRes = await fetch('/api/me')
        if (meRes.ok) {
          const me = await meRes.json()
          setMeId(me.id)
        }
        const res = await fetch('/api/admin/users')
        if (res.status === 403 || res.status === 401) {
          setForbidden(true)
          return
        }
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setUsers(data)
      } catch {
        setToast({ message: 'Σφάλμα φόρτωσης', type: 'error' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const toggleRole = async (user: AdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
      setToast({ message: 'Ενημερώθηκε', type: 'success' })
      setUsers(users.map(u => (u.id === user.id ? { ...u, role: newRole } : u)))
    } catch (err) {
      setToast({ message: (err as Error).message || 'Σφάλμα', type: 'error' })
    }
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/admin/users/${deletingId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed')
      }
      setToast({ message: 'Διαγράφηκε', type: 'success' })
      setUsers(users.filter(u => u.id !== deletingId))
    } catch (err) {
      setToast({ message: (err as Error).message || 'Σφάλμα', type: 'error' })
    } finally {
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

  if (forbidden) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-md p-6 md:p-8 max-w-md text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Δεν έχετε πρόσβαση</h1>
            <p className="text-gray-600 text-sm mb-4">
              Αυτή η σελίδα είναι μόνο για διαχειριστές.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all"
            >
              Επιστροφή
            </button>
          </div>
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
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Διαχείριση Χρηστών</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              {users.length} {users.length === 1 ? 'χρήστης' : 'χρήστες'}
            </p>
          </div>

          <div className="space-y-3">
            {users.map(u => {
              const isMe = u.id === meId
              return (
                <div
                  key={u.id}
                  className="bg-white border-2 border-gray-200 rounded-2xl p-4 md:p-5 shadow-md hover:shadow-lg hover:border-blue-300 transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    {u.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-800 truncate">
                          {u.name || u.email}
                        </h3>
                        {u.role === 'admin' && (
                          <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            Admin
                          </span>
                        )}
                        {isMe && (
                          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            Εσείς
                          </span>
                        )}
                      </div>
                      {u.name && (
                        <p className="text-sm text-gray-500 truncate">{u.email}</p>
                      )}
                    </div>
                  </div>

                  {u.memberships.length > 0 && (
                    <div className="text-xs text-gray-600 mb-3 pl-13">
                      <span className="font-medium">Καταλύματα: </span>
                      {u.memberships.map(m => m.business.name).join(', ')}
                    </div>
                  )}

                  {!isMe && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => toggleRole(u)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium rounded-lg transition-colors text-sm"
                      >
                        {u.role === 'admin' ? 'Αφαίρεση Admin' : 'Ορισμός Admin'}
                      </button>
                      <button
                        onClick={() => setDeletingId(u.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 font-medium rounded-lg transition-colors text-sm"
                      >
                        Διαγραφή
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {deletingId && (
        <Modal
          type="danger"
          title="Διαγραφή Χρήστη"
          message="Είστε βέβαιοι; Ο χρήστης και όλες οι συνδέσεις του με καταλύματα θα διαγραφούν. (Δεν διαγράφει τα δεδομένα στο Clerk — αυτό γίνεται από το Clerk Dashboard.)"
          confirmText="Διαγραφή"
          cancelText="Ακύρωση"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </>
  )
}
