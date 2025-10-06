'use client'

interface AlertProps {
  title?: string
  message: string
  onClose: () => void
  type?: 'success' | 'error' | 'info' | 'warning'
  buttonText?: string
}

export default function Alert({
  title,
  message,
  onClose,
  type = 'info',
  buttonText = 'OK',
}: AlertProps) {
  const styles = {
    success: {
      gradient: 'from-green-500 to-emerald-600',
      icon: '✓',
      iconBg: 'bg-green-100',
      iconText: 'text-green-600',
    },
    error: {
      gradient: 'from-red-500 to-rose-600',
      icon: '✕',
      iconBg: 'bg-red-100',
      iconText: 'text-red-600',
    },
    info: {
      gradient: 'from-blue-500 to-indigo-600',
      icon: 'ℹ',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600',
    },
    warning: {
      gradient: 'from-orange-500 to-amber-600',
      icon: '⚠',
      iconBg: 'bg-orange-100',
      iconText: 'text-orange-600',
    },
  }

  const style = styles[type]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full animate-scale-in overflow-hidden">
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${style.gradient} px-6 py-4`}>
          <div className="flex items-center gap-3">
            <div className={`${style.iconBg} w-10 h-10 rounded-full flex items-center justify-center`}>
              <span className={`${style.iconText} text-xl font-bold`}>{style.icon}</span>
            </div>
            {title && <h3 className="text-lg font-bold text-white">{title}</h3>}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">{message}</p>
        </div>

        {/* Action */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className={`w-full py-3 bg-gradient-to-r ${style.gradient} text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-md`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}
