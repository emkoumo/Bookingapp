import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import type { User } from '@prisma/client'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export async function getCurrentUser(): Promise<User> {
  const { userId } = await auth()
  if (!userId) throw new UnauthorizedError()

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (existing) return existing

  const clerkUser = await currentUser()
  if (!clerkUser) throw new UnauthorizedError()

  const primaryEmail =
    clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    ''

  return prisma.user.create({
    data: {
      clerkId: userId,
      email: primaryEmail,
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
      imageUrl: clerkUser.imageUrl || null,
    },
  })
}

export async function requireBusinessAccess(
  businessId: string,
  opts: { requireOwnerOrAdmin?: boolean } = {}
) {
  const user = await getCurrentUser()

  if (user.role === 'admin') {
    const business = await prisma.business.findUnique({ where: { id: businessId } })
    if (!business) throw new ForbiddenError('Business not found')
    return { user, business, role: 'admin' as const }
  }

  const membership = await prisma.businessMember.findUnique({
    where: { userId_businessId: { userId: user.id, businessId } },
    include: { business: true },
  })
  if (!membership) throw new ForbiddenError('You do not have access to this business')

  if (opts.requireOwnerOrAdmin && membership.role !== 'owner' && membership.role !== 'admin') {
    throw new ForbiddenError('Owner or admin role required')
  }

  return { user, business: membership.business, role: membership.role }
}

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser()
  if (user.role !== 'admin') throw new ForbiddenError('Admin role required')
  return user
}

export function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 })
  }
  return null
}
