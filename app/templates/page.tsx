'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import EmailComposerModal from '@/components/EmailComposerModal'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  imageUrl: string | null
  includeImageByDefault: boolean
}

function TemplatesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get('business')

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null)

  useEffect(() => {
    if (businessId) {
      fetchTemplates()
    }
  }, [businessId])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/email/templates?businessId=${businessId}`)
      const data = await res.json()
      setTemplates(data)
    } catch (error) {
      console.error('Error fetching templates:', error)
      setToast({ message: 'Σφάλμα κατά τη φόρτωση προτύπων', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTemplate = async (template: EmailTemplate) => {
    try {
      const res = await fetch('/api/email/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      })

      if (!res.ok) {
        const errorData = await res.json()
        console.error('API Error:', errorData)
        throw new Error(errorData.error || 'Failed to update template')
      }

      setToast({ message: 'Το πρότυπο ενημερώθηκε επιτυχώς!', type: 'success' })

      // Update the selected template with the saved data so modal stays open
      const updatedTemplate = await res.json()
      setSelectedTemplate(updatedTemplate)

      // Refresh the template list in background
      fetchTemplates()
    } catch (error) {
      console.error('Error saving template:', error)
      setToast({ message: `Σφάλμα: ${(error as Error).message}`, type: 'error' })
    }
  }

  const getTemplateName = (name: string) => {
    switch (name) {
      case 'no_availability':
        return 'Μη Διαθεσιμότητα'
      case 'alternative_dates':
        return 'Εναλλακτικές Ημερομηνίες'
      case 'availability_confirmation':
        return 'Επιβεβαίωση Διαθεσιμότητας'
      case 'booking_confirmation':
        return 'Στοιχεία Πληρωμής'
      default:
        return name
    }
  }

  const getTemplateIcon = (name: string) => {
    switch (name) {
      case 'no_availability':
        return (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'alternative_dates':
        return (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )
      case 'availability_confirmation':
        return (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'booking_confirmation':
        return (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      default:
        return (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
    }
  }

  const getTemplateColor = (name: string) => {
    switch (name) {
      case 'no_availability':
        return 'from-red-500 to-rose-600'
      case 'alternative_dates':
        return 'from-orange-500 to-amber-600'
      case 'availability_confirmation':
        return 'from-green-500 to-emerald-600'
      case 'booking_confirmation':
        return 'from-blue-500 to-indigo-600'
      default:
        return 'from-gray-500 to-slate-600'
    }
  }

  if (!businessId) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
              Δεν επιλέχθηκε επιχείρηση
            </h2>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Επιστροφή στην Αρχική
            </button>
          </div>
        </div>
      </>
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
      {selectedTemplate && (
        <EmailComposerModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onSaveTemplate={handleSaveTemplate}
          businessId={businessId}
        />
      )}
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white md:m-4 md:rounded-xl md:shadow-lg">
            {/* Header Section */}
            <div className="py-3 border-b border-gray-200">
              <div className="flex items-center justify-between px-4">
                <button
                  onClick={() => router.push('/')}
                  className="flex items-center justify-center w-9 h-9 md:w-auto md:h-auto md:px-3 md:py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden md:inline ml-1 text-sm font-medium">Αρχική</span>
                </button>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 absolute left-1/2 transform -translate-x-1/2">
                  Email Templates
                </h1>
                <div className="w-9 h-9 md:w-auto"></div>
              </div>
            </div>

            {/* Templates List */}
            <div className="px-4 py-4">
              {loading ? (
                <div className="text-center py-8 text-gray-600">Φόρτωση...</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className="group p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all transform hover:scale-105"
                    >
                      <div className="text-center">
                        <div className={`w-12 h-12 mx-auto mb-4 bg-gradient-to-br ${getTemplateColor(template.name)} rounded-full flex items-center justify-center`}>
                          {getTemplateIcon(template.name)}
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                          {getTemplateName(template.name)}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2">{template.subject}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-xl">Φόρτωση...</div>
        </div>
      }
    >
      <TemplatesContent />
    </Suspense>
  )
}
