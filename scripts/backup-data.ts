/**
 * Full data backup to a timestamped JSON file under backups/.
 *
 * pg_dump is not installed on this machine, so we export every table through
 * Prisma instead. Run before any change that could touch stored bookings:
 *   npx tsx scripts/backup-data.ts
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'

async function main() {
  const [
    businesses,
    properties,
    bookings,
    emailTemplates,
    paymentMethods,
    priceRanges,
    blockedDates,
  ] = await Promise.all([
    prisma.business.findMany(),
    prisma.property.findMany(),
    prisma.booking.findMany(),
    prisma.emailTemplate.findMany(),
    prisma.paymentMethod.findMany(),
    prisma.priceRange.findMany(),
    prisma.blockedDate.findMany(),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    counts: {
      businesses: businesses.length,
      properties: properties.length,
      bookings: bookings.length,
      emailTemplates: emailTemplates.length,
      paymentMethods: paymentMethods.length,
      priceRanges: priceRanges.length,
      blockedDates: blockedDates.length,
    },
    data: {
      businesses,
      properties,
      bookings,
      emailTemplates,
      paymentMethods,
      priceRanges,
      blockedDates,
    },
  }

  const dir = join(process.cwd(), 'backups')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = join(dir, `data-backup-${stamp}.json`)

  // Decimal fields serialise via toJSON; BigInt would not, but the schema has none.
  writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8')

  console.log(`Backup written: ${file}`)
  console.log(payload.counts)
}

main()
  .catch((e) => {
    console.error('Backup FAILED:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
