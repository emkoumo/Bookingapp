/**
 * READ-ONLY snapshot of current booking prices, for the price-corruption repair.
 *
 * Writes nothing to the database and nothing to disk — it only prints JSON to
 * stdout, so it is safe to run against production:
 *   npx tsx scripts/dump-bookings.ts > /tmp/db-bookings.json
 */
import { prisma } from '../lib/prisma'

async function main() {
  const bookings = await prisma.booking.findMany({
    include: { property: { select: { name: true } } },
    orderBy: [{ checkIn: 'asc' }, { customerName: 'asc' }],
  })

  const rows = bookings.map((b) => ({
    id: b.id,
    customerName: b.customerName,
    property: b.property.name,
    checkIn: b.checkIn.toISOString().slice(0, 10),
    checkOut: b.checkOut.toISOString().slice(0, 10),
    status: b.status,
    totalPrice: b.totalPrice === null ? null : Number(b.totalPrice),
    advancePayment: b.advancePayment === null ? null : Number(b.advancePayment),
    remainingBalance: b.remainingBalance === null ? null : Number(b.remainingBalance),
    extraBedTotal: b.extraBedTotal === null ? null : Number(b.extraBedTotal),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }))

  console.log(JSON.stringify({ count: rows.length, bookings: rows }, null, 2))
}

main()
  .catch((e) => {
    console.error('Dump FAILED:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
