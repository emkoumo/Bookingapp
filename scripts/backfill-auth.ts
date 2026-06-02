/**
 * Backfill script — links existing businesses to an admin user.
 *
 * Run AFTER:
 *   1. Schema migration applied (User + BusinessMember tables exist).
 *   2. Admin has signed in to the app at least once (so a User row exists).
 *
 * Usage:
 *   tsx scripts/backfill-auth.ts <admin-email>
 *
 * Examples:
 *   # Against dev DB (loads .env.development.local automatically)
 *   tsx scripts/backfill-auth.ts you@example.com
 *
 *   # Against prod DB explicitly
 *   DATABASE_URL="postgresql://..." tsx scripts/backfill-auth.ts you@example.com
 *
 * What it does (idempotent — safe to re-run):
 *   1. Finds User row matching the given email.
 *   2. Promotes that user to role='admin'.
 *   3. For every Business that has zero members, creates a BusinessMember
 *      linking it to the admin user as 'owner'.
 *   4. Does NOT touch businesses that already have members.
 *   5. Does NOT touch any other user, booking, property, or template.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email) {
    console.error('Error: email argument required')
    console.error('Usage: tsx scripts/backfill-auth.ts <admin-email>')
    process.exit(1)
  }

  console.log(`\nLooking for user with email: ${email}`)

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })

  if (!user) {
    console.error(`\n❌ No User row found with email "${email}".`)
    console.error('   The admin must sign in to the app at least once before running this script.')
    console.error('   (Signing in lazily creates the User row from the Clerk session.)')
    process.exit(1)
  }

  console.log(`✓ Found user: ${user.id} (clerkId: ${user.clerkId})`)

  if (user.role !== 'admin') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } })
    console.log(`✓ Promoted user to role='admin' (was '${user.role}')`)
  } else {
    console.log(`✓ User already has role='admin'`)
  }

  const orphanBusinesses = await prisma.business.findMany({
    where: { members: { none: {} } },
    orderBy: { createdAt: 'asc' },
  })

  if (orphanBusinesses.length === 0) {
    console.log(`\n✓ No orphan businesses found — every business already has a member.`)
    console.log(`\nDone.\n`)
    return
  }

  console.log(`\nFound ${orphanBusinesses.length} orphan business(es) without any members:`)
  for (const b of orphanBusinesses) {
    console.log(`  - ${b.name} (${b.id})`)
  }

  console.log(`\nLinking each as 'owner' to admin user...`)

  let linked = 0
  for (const business of orphanBusinesses) {
    await prisma.businessMember.create({
      data: { userId: user.id, businessId: business.id, role: 'owner' },
    })
    console.log(`  ✓ Linked: ${business.name}`)
    linked++
  }

  console.log(`\n✓ Done. Linked ${linked} business(es) to ${email}.\n`)
}

main()
  .catch(error => {
    console.error('\n❌ Backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
