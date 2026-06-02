import { NextResponse } from 'next/server'
import { getCurrentUser, authErrorResponse } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error fetching current user:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
