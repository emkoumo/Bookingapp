import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, authErrorResponse } from '@/lib/auth'
import { defaultEmailTemplates } from '@/lib/defaultTemplates'

export async function GET() {
  try {
    const user = await getCurrentUser()

    const businesses =
      user.role === 'admin'
        ? await prisma.business.findMany({ orderBy: { name: 'asc' } })
        : await prisma.business.findMany({
            where: { members: { some: { userId: user.id } } },
            orderBy: { name: 'asc' },
          })

    return NextResponse.json(businesses)
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error fetching businesses:', error)
    return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const name = (body?.name ?? '').toString().trim()
    const email = (body?.email ?? '').toString().trim()

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const business = await prisma.$transaction(async tx => {
      const created = await tx.business.create({ data: { name, email } })
      await tx.businessMember.create({
        data: { userId: user.id, businessId: created.id, role: 'owner' },
      })
      await tx.emailTemplate.createMany({
        data: defaultEmailTemplates(name).map(t => ({ ...t, businessId: created.id })),
      })
      return created
    })

    return NextResponse.json(business, { status: 201 })
  } catch (error) {
    const authResp = authErrorResponse(error)
    if (authResp) return authResp
    console.error('Error creating business:', error)
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 })
  }
}
