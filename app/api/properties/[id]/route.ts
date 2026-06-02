import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBusinessAccess, authErrorResponse } from '@/lib/auth'

async function loadProperty(id: string) {
  return prisma.property.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, businessId: true, icalUrl: true },
  })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const property = await loadProperty(id)
    if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await requireBusinessAccess(property.businessId)
    return NextResponse.json(property)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error fetching property:', error)
    return NextResponse.json({ error: 'Failed to fetch property' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const property = await loadProperty(id)
    if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await requireBusinessAccess(property.businessId, { requireOwnerOrAdmin: true })

    const body = await req.json()
    const data: { name?: string; description?: string | null; icalUrl?: string | null } = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (typeof body.description === 'string') data.description = body.description.trim() || null
    if (typeof body.icalUrl === 'string') data.icalUrl = body.icalUrl.trim() || null

    const updated = await prisma.property.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error updating property:', error)
    return NextResponse.json({ error: 'Failed to update property' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const property = await loadProperty(id)
    if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await requireBusinessAccess(property.businessId, { requireOwnerOrAdmin: true })
    await prisma.property.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error deleting property:', error)
    return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 })
  }
}
