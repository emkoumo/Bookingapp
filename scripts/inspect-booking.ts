/**
 * READ-ONLY inspection of a single booking, plus any near-duplicates for the
 * same guest. Prints JSON to stdout; writes nothing.
 *
 *   npx tsx --env-file=.env scripts/inspect-booking.ts <bookingId>
 */
import { prisma } from '../lib/prisma'

async function main() {
  const id = process.argv[2]
  if (!id) throw new Error('usage: inspect-booking.ts <bookingId>')

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { property: { include: { business: { select: { id: true, name: true } } } } },
  })

  if (!booking) {
    console.log(JSON.stringify({ found: false, id }, null, 2))
    return
  }

  // Everything for this guest, to see the full set of rows they own.
  const firstWord = booking.customerName.split(/\s+/)[0]
  const siblings = await prisma.booking.findMany({
    where: { customerName: { contains: firstWord, mode: 'insensitive' } },
    include: { property: { select: { name: true } } },
    orderBy: { checkIn: 'asc' },
  })

  console.log(
    JSON.stringify(
      {
        found: true,
        record: booking,
        siblingCount: siblings.length,
        siblings: siblings.map((s) => ({
          id: s.id,
          customerName: s.customerName,
          property: s.property.name,
          checkIn: s.checkIn.toISOString().slice(0, 10),
          checkOut: s.checkOut.toISOString().slice(0, 10),
          status: s.status,
          source: s.source,
          externalId: s.externalId,
          totalPrice: s.totalPrice === null ? null : Number(s.totalPrice),
          advancePayment: s.advancePayment === null ? null : Number(s.advancePayment),
          notes: s.notes,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error('Inspect FAILED:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
