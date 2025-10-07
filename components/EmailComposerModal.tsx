'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { el } from 'date-fns/locale'
import DatePicker from './DatePicker'

// Toast notification state
let toastTimeout: NodeJS.Timeout

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  imageUrl: string | null
  includeImageByDefault: boolean
}

interface DateRange {
  id: string
  startDate: string
  endDate: string
}

interface EmailComposerModalProps {
  template: EmailTemplate
  onClose: () => void
  onSaveTemplate: (template: EmailTemplate) => void
  businessId: string
}

export default function EmailComposerModal({
  template,
  onClose,
  onSaveTemplate,
  businessId,
}: EmailComposerModalProps) {
  const [editedTemplate, setEditedTemplate] = useState({
    ...template,
    includeImageByDefault: template.includeImageByDefault ?? false, // Ensure boolean
  })
  const [dateRanges, setDateRanges] = useState<DateRange[]>([
    { id: '1', startDate: '', endDate: '' }, // Always have first date range
  ])
  // Initialize with template's default settings
  const [includePriceList, setIncludePriceList] = useState(template.includeImageByDefault ?? false)
  const [priceListImage, setPriceListImage] = useState(template.imageUrl || '')
  const [isEditingTemplate, setIsEditingTemplate] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [isMobile, setIsMobile] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)

  // Sync editedTemplate when template prop changes (after save)
  useEffect(() => {
    setEditedTemplate({
      ...template,
      includeImageByDefault: template.includeImageByDefault ?? false,
    })
    setIncludePriceList(template.includeImageByDefault ?? false)
    setPriceListImage(template.imageUrl || '')
  }, [template])

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    clearTimeout(toastTimeout)
    toastTimeout = setTimeout(() => {
      setToastMessage('')
    }, 3000)
  }

  // Add new date range
  const addDateRange = () => {
    setDateRanges([...dateRanges, { id: Date.now().toString(), startDate: '', endDate: '' }])
  }

  // Remove date range
  const removeDateRange = (id: string) => {
    setDateRanges(dateRanges.filter((range) => range.id !== id))
  }

  // Update date range
  const updateDateRange = (id: string, field: 'startDate' | 'endDate', value: string) => {
    setDateRanges(
      dateRanges.map((range) => (range.id === id ? { ...range, [field]: value } : range))
    )
  }

  // Generate preview image whenever dates change
  useEffect(() => {
    if (template.name === 'alternative_dates') {
      const validRanges = dateRanges.filter(r => r.startDate && r.endDate)
      if (validRanges.length > 0) {
        generateImageWithDates()
          .then(blob => {
            const url = URL.createObjectURL(blob)
            if (previewImageUrl) URL.revokeObjectURL(previewImageUrl)
            setPreviewImageUrl(url)
          })
          .catch(err => {
            console.error('Preview generation error:', err)
            setPreviewImageUrl(null)
          })
      } else {
        setPreviewImageUrl(null)
      }
    }
    // Cleanup
    return () => {
      if (previewImageUrl) URL.revokeObjectURL(previewImageUrl)
    }
  }, [dateRanges, template.name])

  // Format alternative dates for email
  const formatAlternativeDates = () => {
    const validRanges = dateRanges.filter((range) => range.startDate && range.endDate)

    if (validRanges.length === 0) return '[No dates added]'

    // If only one date range, no numbering
    if (validRanges.length === 1) {
      const range = validRanges[0]
      const start = format(new Date(range.startDate), 'd MMM yyyy', { locale: el })
      const end = format(new Date(range.endDate), 'd MMM yyyy', { locale: el })
      return `${start} - ${end}`
    }

    // Multiple ranges: add numbering
    return validRanges
      .map((range, index) => {
        const start = format(new Date(range.startDate), 'd MMM yyyy', { locale: el })
        const end = format(new Date(range.endDate), 'd MMM yyyy', { locale: el })
        return `${index + 1}. ${start} - ${end}`
      })
      .join('\n')
  }

  // Simple copy to clipboard (for subject/body preview)
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('✅ Αντιγράφηκε!')
    } catch (err) {
      showToast('❌ Σφάλμα αντιγραφής', 'error')
    }
  }

  // Copy email text only (works everywhere!)
  const copyEmailText = async () => {
    try {
      const plainTextBody = generateEmailBody()
      const plainText = `Subject: ${editedTemplate.subject}\n\n${plainTextBody}`
      await navigator.clipboard.writeText(plainText)
      showToast('✅ Κείμενο αντιγράφηκε!')
    } catch (err) {
      console.error('Copy text error:', err)
      showToast('❌ Σφάλμα αντιγραφής κειμένου', 'error')
    }
  }

  // Generate image with alternative dates overlay (canvas-based)
  const generateImageWithDates = async (): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Map businessId to folder name
        console.log('BusinessId:', businessId)
        const businessFolder = businessId.includes('evaggelia') ? 'evaggelia' : 'elegancia'
        console.log('Selected folder:', businessFolder)
        const templatePath = `/email-templates/${businessFolder}/alternative-dates.png`

        // Load the base template image
        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
          // Create canvas with same dimensions as image
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            reject(new Error('Canvas not supported'))
            return
          }

          // Draw base image
          ctx.drawImage(img, 0, 0)

          // Configure text style - Evaggelia specs
          ctx.font = '300 21px Geologica, Arial, sans-serif'
          ctx.fillStyle = '#ffffff'
          ctx.textAlign = 'left'

          // Draw alternative dates
          const validRanges = dateRanges.filter(r => r.startDate && r.endDate)
          const startX = 24
          let startY = 420
          const lineSpacing = 8

          validRanges.forEach((range, index) => {
            // Format dates as "10-20 Oct 2025"
            const startDate = new Date(range.startDate)
            const endDate = new Date(range.endDate)
            const startDay = startDate.getDate()
            const endDay = endDate.getDate()
            const month = format(endDate, 'MMM yyyy', { locale: el })
            const dateText = `${index + 1}. ${startDay}-${endDay} ${month}`
            const y = startY + (index * (21 + lineSpacing)) // 21px font height + 8px spacing
            ctx.fillText(dateText, startX, y)
          })

          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to generate image'))
            }
          }, 'image/png')
        }

        img.onerror = (e) => {
          console.error('Image load error:', e)
          console.error('Template path:', templatePath)
          reject(new Error(`Failed to load template image: ${templatePath}`))
        }

        console.log('Loading template image from:', templatePath)
        img.src = templatePath
      } catch (err) {
        console.error('Canvas generation error:', err)
        reject(err)
      }
    })
  }

  // Copy generated image with dates overlay
  const copyImageBlob = async () => {
    try {
      // For alternative dates template, generate image with overlay
      if (editedTemplate.name === 'alternative_dates') {
        console.log('Starting image generation...')

        // CRITICAL for iOS: Create ClipboardItem IMMEDIATELY (synchronously) with a promise
        // This must happen within the user gesture event handler
        const clipboardItemPromise = new ClipboardItem({
          'image/png': generateImageWithDates()
        })

        console.log('ClipboardItem created, writing to clipboard...')

        // Now write to clipboard - this maintains the user gesture context
        await navigator.clipboard.write([clipboardItemPromise])

        console.log('Clipboard write successful')
        showToast('✅ Εικόνα αντιγράφηκε!')
      } else {
        // For other templates, use old method with price list image
        if (!includePriceList || !priceListImage) {
          showToast('❌ Δεν υπάρχει εικόνα', 'error')
          return
        }

        const imageUrl = priceListImage.startsWith('http')
          ? priceListImage
          : `${window.location.origin}${priceListImage}`

        const response = await fetch(imageUrl)
        const blob = await response.blob()

        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

        if (isSafari) {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: Promise.resolve(blob)
            })
          ])
        } else {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ])
        }

        showToast('✅ Εικόνα αντιγράφηκε!')
      }
    } catch (err) {
      console.error('Copy image error:', err)
      showToast('❌ Σφάλμα αντιγραφής εικόνας', 'error')
    }
  }

  // Generate final email body with replacements (plain text - no image)
  const generateEmailBody = () => {
    let body = editedTemplate.body

    // Replace alternative dates
    const alternativeDates = formatAlternativeDates()
    body = body.replace(/\{\{ALTERNATIVE_DATES\}\}/g, alternativeDates)

    return body
  }


  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('businessId', businessId)

    try {
      setUploadingImage(true)
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()

      // If in template edit mode, save to template
      if (isEditingTemplate) {
        setEditedTemplate({ ...editedTemplate, imageUrl: data.url })
      } else {
        // If in email compose mode, use for this email only
        setPriceListImage(data.url)
        setIncludePriceList(true)
      }
    } catch (error) {
      alert('Σφάλμα κατά τη μεταφόρτωση')
    } finally {
      setUploadingImage(false)
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
        return 'Επιβεβαίωση Κράτησης'
      default:
        return name
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 md:flex md:items-center md:justify-center z-[70] md:p-4">
      <div className="bg-white h-full md:h-auto md:rounded-2xl shadow-2xl md:max-w-4xl w-full md:my-8 animate-scale-in flex flex-col md:max-h-[90vh]">
        {/* Header - Sticky on mobile */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 md:px-6 py-4 md:rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-bold text-white">
              {getTemplateName(template.name)}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:opacity-80 transition-opacity text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* SIMPLIFIED UI for Alternative Dates - No tabs, no previews */}
          {template.name === 'alternative_dates' ? (
            <>
              {/* Alternative Dates Builder */}
              <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Εναλλακτικές Ημερομηνίες
                  </label>
                  <div className="space-y-3">
                    {dateRanges.map((range, index) => (
                      <div key={range.id} className="flex items-center gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <DatePicker
                            value={range.startDate}
                            onChange={(date) => updateDateRange(range.id, 'startDate', date)}
                            placeholder="Από"
                            isEditMode={false}
                            minDate={format(new Date(), 'yyyy-MM-dd')}
                            maxDate={range.endDate || undefined}
                            highlightDate={range.endDate || undefined}
                          />
                          <DatePicker
                            value={range.endDate}
                            onChange={(date) => updateDateRange(range.id, 'endDate', date)}
                            placeholder="Έως"
                            isEditMode={false}
                            minDate={range.startDate || format(new Date(), 'yyyy-MM-dd')}
                            highlightDate={range.startDate || undefined}
                          />
                        </div>
                        {/* Only show delete button after first range */}
                        {index > 0 && (
                          <button
                            onClick={() => removeDateRange(range.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {dateRanges.length < 3 && (
                      <button
                        onClick={addDateRange}
                        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors font-medium"
                      >
                        + Προσθήκη Περιόδου (max 3)
                      </button>
                    )}
                  </div>
              </div>

              {/* Live Canvas Preview */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Προεπισκόπηση
                </label>
                <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                  {previewImageUrl ? (
                    <div className="flex flex-col items-center">
                      <img
                        src={previewImageUrl}
                        alt="Preview with dates"
                        className="max-w-full h-auto rounded shadow-md"
                      />
                      <div className="text-sm text-green-600 mt-2 font-medium">
                        ✓ Έτοιμο για αντιγραφή
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-700 mb-2">
                        📅 Επιλέξτε ημερομηνίες για προεπισκόπηση
                      </div>
                      <div className="text-sm text-gray-600">
                        Η εικόνα θα δημιουργηθεί αυτόματα
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* OLD UI for non-canvas templates */
            <>
              {/* Toggle: Compose Email vs Edit Template */}
              <div className="flex gap-2 border-b border-gray-200 pb-3">
                <button
                  onClick={() => setIsEditingTemplate(false)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    !isEditingTemplate
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Σύνταξη Email
                </button>
                <button
                  onClick={() => setIsEditingTemplate(true)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    isEditingTemplate
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Επεξεργασία Προτύπου
                </button>
              </div>

              {!isEditingTemplate ? (
                <>
                  {/* Price List Image */}
                  <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Λίστα Τιμών
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePriceList}
                        onChange={(e) => setIncludePriceList(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Συμπερίληψη λίστας τιμών</span>
                    </label>

                    {includePriceList && (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="price-list-upload"
                        />
                        <label
                          htmlFor="price-list-upload"
                          className={`block w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors ${
                            uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {uploadingImage ? (
                            <span className="text-gray-600">Μεταφόρτωση...</span>
                          ) : priceListImage ? (
                            <div className="space-y-2">
                              <img
                                src={priceListImage}
                                alt="Price List"
                                className="max-h-32 mx-auto rounded"
                              />
                              <span className="text-sm text-green-600">✓ Εικόνα ανέβηκε</span>
                            </div>
                          ) : (
                            <span className="text-gray-600">📤 Κλικ για ανέβασμα εικόνας</span>
                          )}
                        </label>
                      </div>
                    )}
                  </div>
                  </div>

              {/* Email Preview */}
              <div className="border-t-2 border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">Προεπισκόπηση Email</h3>
                </div>

                {/* Subject with Copy */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Θέμα</label>
                    <button
                      onClick={() => copyToClipboard(editedTemplate.subject)}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      📋 Αντιγραφή
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-gray-800 font-medium">
                    {editedTemplate.subject}
                  </div>
                </div>

                {/* Body with Copy */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Κείμενο</label>
                    <button
                      onClick={() => copyToClipboard(generateEmailBody())}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                    >
                      📋 Αντιγραφή Email
                    </button>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-gray-800 whitespace-pre-wrap text-sm">
                    {generateEmailBody()}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Template Editor */
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Θέμα Email</label>
                <input
                  type="text"
                  value={editedTemplate.subject}
                  onChange={(e) =>
                    setEditedTemplate({ ...editedTemplate, subject: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Κείμενο Email (English)
                </label>
                <textarea
                  rows={10}
                  value={editedTemplate.body}
                  onChange={(e) => setEditedTemplate({ ...editedTemplate, body: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-mono text-sm"
                />
              </div>

              {/* Default Image Settings */}
              <div className="border-2 border-gray-300 rounded-lg p-4">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Προεπιλεγμένη Εικόνα Λίστας Τιμών
                </label>

                {/* Toggle */}
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={editedTemplate.includeImageByDefault}
                    onChange={(e) =>
                      setEditedTemplate({
                        ...editedTemplate,
                        includeImageByDefault: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 font-medium">
                    Ενεργοποίηση εικόνας από προεπιλογή
                  </span>
                </label>

                {/* Image Upload/URL */}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="template-image-upload"
                  />
                  <label
                    htmlFor="template-image-upload"
                    className={`block w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors ${
                      uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {uploadingImage ? (
                      <span className="text-gray-600">Μεταφόρτωση...</span>
                    ) : editedTemplate.imageUrl ? (
                      <div className="space-y-2">
                        <img
                          src={editedTemplate.imageUrl}
                          alt="Price List"
                          className="max-h-32 mx-auto rounded"
                        />
                        <span className="text-sm text-green-600">✓ Εικόνα αποθηκευμένη</span>
                      </div>
                    ) : (
                      <span className="text-gray-600">📤 Κλικ για ανέβασμα εικόνας</span>
                    )}
                  </label>

                  {/* URL Input Alternative */}
                  <div className="mt-3">
                    <label className="block text-xs text-gray-600 mb-1">Ή επικόλληση URL εικόνας:</label>
                    <input
                      type="text"
                      value={editedTemplate.imageUrl || ''}
                      onChange={(e) =>
                        setEditedTemplate({ ...editedTemplate, imageUrl: e.target.value || null })
                      }
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          </>
        )}
        </div>

        {/* Footer - Sticky */}
        <div className="bg-white border-t border-gray-200 px-4 md:px-6 py-4 md:rounded-b-2xl sticky bottom-0">
          {template.name === 'alternative_dates' ? (
            /* Simple footer for Alternative Dates */
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
              >
                Ακύρωση
              </button>
              <button
                onClick={() => copyImageBlob()}
                disabled={dateRanges.filter(r => r.startDate && r.endDate).length === 0}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-opacity shadow-md text-lg ${
                  dateRanges.filter(r => r.startDate && r.endDate).length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-90'
                }`}
              >
                Αντιγραφή
              </button>
            </div>
          ) : !isEditingTemplate ? (
            /* Compose Email Footer */
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
              >
                Ακύρωση
              </button>
              <button
                onClick={() => copyEmailText()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md"
              >
                📝 Αντιγραφή Κειμένου
              </button>
              {(includePriceList && priceListImage) && (
                <button
                  onClick={() => copyImageBlob()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md"
                >
                  🖼️ Αντιγραφή Εικόνας
                </button>
              )}
            </div>
          ) : (
            /* Template Editor Footer */
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
              >
                Κλείσιμο
              </button>
              <button
                onClick={() => onSaveTemplate(editedTemplate)}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:opacity-90 font-semibold transition-opacity shadow-md"
              >
                Αποθήκευση
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[80] animate-slide-in">
          <div
            className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 ${
              toastType === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <span className="text-lg font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  )
}
