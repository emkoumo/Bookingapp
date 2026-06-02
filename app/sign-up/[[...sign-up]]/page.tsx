import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="flex flex-col items-center mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg mb-3">
          📅
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Booking App</h1>
        <p className="text-sm text-gray-500 mt-1">Δημιουργία Λογαριασμού</p>
      </div>

      <SignUp
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm',
            card: 'shadow-xl rounded-2xl border-2 border-gray-200',
            headerTitle: 'text-xl font-bold text-gray-800',
            headerSubtitle: 'text-sm text-gray-500',
            formButtonPrimary:
              'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md transition-all',
            footerActionLink: 'text-blue-600 hover:text-blue-700 font-medium',
          },
        }}
      />
    </div>
  )
}
