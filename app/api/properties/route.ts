import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBusinessAccess, authErrorResponse } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    await requireBusinessAccess(businessId)

    const properties = await prisma.property.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(properties)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error fetching properties:', error)
    return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const businessId = (body?.businessId ?? '').toString().trim()
    const name = (body?.name ?? '').toString().trim()
    const description = body?.description?.toString().trim() || null

    if (!businessId) return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    await requireBusinessAccess(businessId, { requireOwnerOrAdmin: true })

    const property = await prisma.property.create({
      data: { businessId, name, description },
    })
    return NextResponse.json(property, { status: 201 })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error creating property:', error)
    return NextResponse.json({ error: 'Failed to create property' }, { status: 500 })
  }
}
