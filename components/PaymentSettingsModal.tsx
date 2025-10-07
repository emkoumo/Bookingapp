'use client'

import { useState, useEffect } from 'react'

interface PaymentMethod {
  id: string
  type: string
  label: string
  details: {
    bankName?: string
    accountName?: string
    accountNumber?: string
    iban?: string
    swift?: string
    fullName?: string
    country?: string
    city?: string
    phone?: string
  }
}

interface PaymentSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string
}

export default function PaymentSettingsModal({ isOpen, onClose, businessId }: PaymentSettingsModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bank_business' | 'bank_personal' | 'western_union'>('bank_business')
  const [formData, setFormData] = useState({
    details: {} as any
  })

  useEffect(() => {
    if (isOpen && businessId) {
      fetchPaymentMethods()
    }
  }, [isOpen, businessId])

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch(`/api/payment-methods?businessId=${businessId}`)
      const data = await res.json()
      setPaymentMethods(data)
    } catch (error) {
      console.error('Error fetching payment methods:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (method: PaymentMethod) => {
    try {
      await fetch('/api/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method),
      })
      fetchPaymentMethods()
      setEditing(null)
    } catch (error) {
      console.error('Error updating payment method:', error)
    }
  }

  const handleAdd = async () => {
    // Generate a simple label based on type
    const label = getTabLabel(activeTab)

    try {
      await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          type: activeTab,
          label,
          details: formData.details,
        }),
      })
      fetchPaymentMethods()
      setFormData({ details: {} })
    } catch (error) {
      console.error('Error creating payment method:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη μέθοδο πληρωμής;')) {
      return
    }

    try {
      await fetch(`/api/payment-methods?id=${id}`, {
        method: 'DELETE',
      })
      fetchPaymentMethods()
    } catch (error) {
      console.error('Error deleting payment method:', error)
    }
  }

  const renderFormFields = (type: string, details: any, onChange: (field: string, value: string) => void) => {
    if (type === 'bank_business' || type === 'bank_personal') {
      return (
        <>
          <input
            type="text"
            placeholder="Όνομα Τράπεζας"
            value={details.bankName || ''}
            onChange={(e) => onChange('bankName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
          <input
            type="text"
            placeholder="Όνομα Λογαριασμού"
            value={details.accountName || ''}
            onChange={(e) => onChange('accountName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
          <input
            type="text"
            placeholder="Αριθμός Λογαριασμού / IBAN"
            value={details.accountNumber || details.iban || ''}
            onChange={(e) => onChange('accountNumber', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
          <input
            type="text"
            placeholder="BIC/SWIFT"
            value={details.swift || ''}
            onChange={(e) => onChange('swift', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
        </>
      )
    } else if (type === 'western_union') {
      return (
        <>
          <input
            type="text"
            placeholder="Πλήρες Όνομα"
            value={details.fullName || ''}
            onChange={(e) => onChange('fullName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
          <input
            type="text"
            placeholder="Χώρα"
            value={details.country || ''}
            onChange={(e) => onChange('country', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
          <input
            type="text"
            placeholder="Πόλη"
            value={details.city || ''}
            onChange={(e) => onChange('city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
          <input
            type="text"
            placeholder="Τηλέφωνο"
            value={details.phone || ''}
            onChange={(e) => onChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
          />
        </>
      )
    }
    return null
  }

  const getTabLabel = (type: string) => {
    if (type === 'bank_business') return 'Επαγγελματικός'
    if (type === 'bank_personal') return 'Προσωπικός'
    if (type === 'western_union') return 'Western Union'
    return type
  }

  const filteredMethods = paymentMethods.filter(m => m.type === activeTab)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 md:flex md:items-center md:justify-center z-[70] md:p-4">
      <div className="bg-white h-full md:h-auto md:rounded-2xl shadow-2xl md:max-w-3xl w-full md:my-8 animate-scale-in flex flex-col md:max-h-[90vh]">
        {/* Header - Sticky on mobile */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 md:px-6 py-4 md:rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-white">Μέθοδοι Πληρωμής</h2>
            <button
              onClick={onClose}
              className="text-white hover:opacity-80 transition-opacity text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs - Sticky below header */}
        <div className="flex border-b border-gray-200 bg-gray-50 sticky top-[60px] z-10">
          <button
            onClick={() => setActiveTab('bank_business')}
            className={`flex-1 px-3 md:px-4 py-3 text-xs md:text-sm font-medium transition-colors ${
              activeTab === 'bank_business'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Επαγγελματικός
          </button>
          <button
            onClick={() => setActiveTab('bank_personal')}
            className={`flex-1 px-3 md:px-4 py-3 text-xs md:text-sm font-medium transition-colors ${
              activeTab === 'bank_personal'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Προσωπικός
          </button>
          <button
            onClick={() => setActiveTab('western_union')}
            className={`flex-1 px-3 md:px-4 py-3 text-xs md:text-sm font-medium transition-colors ${
              activeTab === 'western_union'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Western Union
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Add New */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-gray-900 mb-3 text-sm">Προσθήκη Νέας Μεθόδου</h3>
            <div className="space-y-3">
              {renderFormFields(activeTab, formData.details, (field, value) => {
                setFormData({
                  ...formData,
                  details: { ...formData.details, [field]: value }
                })
              })}
              <button
                onClick={handleAdd}
                className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity text-sm"
              >
                Προσθήκη
              </button>
            </div>
          </div>

          {/* Existing Methods */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-gray-600 text-sm">Φόρτωση...</div>
            ) : filteredMethods.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Δεν υπάρχουν μέθοδοι πληρωμής για {getTabLabel(activeTab)}
              </div>
            ) : (
              filteredMethods.map((method) => (
                <div key={method.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{method.label}</h3>
                      <p className="text-xs text-gray-500">{getTabLabel(method.type)}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(editing === method.id ? null : method.id)}
                        className="p-2 text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Επεξεργασία"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(method.id)}
                        className="p-2 text-red-600 border border-red-300 hover:bg-red-50 rounded-lg transition-colors"
                        title="Διαγραφή"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {editing === method.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={method.label}
                        onChange={(e) => setPaymentMethods(paymentMethods.map(m =>
                          m.id === method.id ? { ...m, label: e.target.value } : m
                        ))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-semibold text-sm"
                      />
                      {renderFormFields(method.type, method.details, (field, value) => {
                        setPaymentMethods(paymentMethods.map(m =>
                          m.id === method.id
                            ? { ...m, details: { ...m.details, [field]: value } }
                            : m
                        ))
                      })}
                      <button
                        onClick={() => handleSave(method)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors text-sm"
                      >
                        Αποθήκευση
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 text-xs text-gray-700">
                      {method.type !== 'western_union' ? (
                        <>
                          <p><span className="font-semibold">Τράπεζα:</span> {method.details.bankName}</p>
                          <p><span className="font-semibold">Όνομα:</span> {method.details.accountName}</p>
                          <p><span className="font-semibold">Αριθμός:</span> {method.details.accountNumber || method.details.iban}</p>
                          {method.details.swift && <p><span className="font-semibold">BIC/SWIFT:</span> {method.details.swift}</p>}
                        </>
                      ) : (
                        <>
                          <p><span className="font-semibold">Όνομα:</span> {method.details.fullName}</p>
                          <p><span className="font-semibold">Χώρα:</span> {method.details.country}</p>
                          <p><span className="font-semibold">Πόλη:</span> {method.details.city}</p>
                          <p><span className="font-semibold">Τηλέφωνο:</span> {method.details.phone}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
