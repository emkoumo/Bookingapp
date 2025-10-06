'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const styles = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
    warning: 'bg-orange-500 text-white',
  }

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[60] animate-slide-down">
      <div
        className={`${styles[type]} px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px] max-w-md`}
      >
        <span className="text-2xl">{icons[type]}</span>
        <p className="font-medium text-sm flex-1">{message}</p>
        <button
          onClick={onClose}
          className="text-white hover:opacity-80 transition-opacity text-xl leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}
