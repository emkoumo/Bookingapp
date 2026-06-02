import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBusinessAccess, authErrorResponse } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { business } = await requireBusinessAccess(id)
    return NextResponse.json(business)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error fetching business:', error)
    return NextResponse.json({ error: 'Failed to fetch business' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await requireBusinessAccess(id, { requireOwnerOrAdmin: true })

    const body = await req.json()
    const data: { name?: string; email?: string } = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (typeof body.email === 'string' && body.email.trim()) data.email = body.email.trim()

    const updated = await prisma.business.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error updating business:', error)
    return NextResponse.json({ error: 'Failed to update business' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await requireBusinessAccess(id, { requireOwnerOrAdmin: true })
    await prisma.business.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error deleting business:', error)
    return NextResponse.json({ error: 'Failed to delete business' }, { status: 500 })
  }
}
