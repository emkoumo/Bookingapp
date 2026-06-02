import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireBusinessAccess, authErrorResponse } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 })
    }

    await requireBusinessAccess(businessId)

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(paymentMethods)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error fetching payment methods:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, type, label, details } = body

    if (!businessId || !type || !label || !details) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await requireBusinessAccess(businessId)

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        businessId,
        type,
        label,
        details,
      },
    })

    return NextResponse.json(paymentMethod, { status: 201 })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error creating payment method:', error)
    return NextResponse.json(
      { error: 'Failed to create payment method' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, label, details } = body

    if (!id || !label || !details) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const existing = await prisma.paymentMethod.findUnique({
      where: { id },
      select: { businessId: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Payment method not found' },
        { status: 404 }
      )
    }

    await requireBusinessAccess(existing.businessId)

    const paymentMethod = await prisma.paymentMethod.update({
      where: { id },
      data: { label, details },
    })

    return NextResponse.json(paymentMethod)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error updating payment method:', error)
    return NextResponse.json(
      { error: 'Failed to update payment method' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const existing = await prisma.paymentMethod.findUnique({
      where: { id },
      select: { businessId: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Payment method not found' },
        { status: 404 }
      )
    }

    await requireBusinessAccess(existing.businessId)

    await prisma.paymentMethod.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error deleting payment method:', error)
    return NextResponse.json(
      { error: 'Failed to delete payment method' },
      { status: 500 }
    )
  }
}
