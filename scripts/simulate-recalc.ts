/**
 * READ-ONLY simulation of recalculateBookingsForProperty for every property.
 *
 * Mirrors the real function's candidate query and per-night maths but writes
 * nothing, so it answers "what would the next price-list save do?" safely.
 *
 *   npx tsx --env-file=.env scripts/simulate-recalc.ts
 */
import { prisma } from '../lib/prisma'

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function computeRoomTotal(
  checkIn: Date,
  checkOut: Date,
  ranges: Array<{ dateFrom: Date; dateTo: Date; pricePerNight: unknown }>
): number | null {
  const cursor = new Date(checkIn)
  cursor.setUTCHours(0, 0, 0, 0)
  const end = new Date(checkOut)
  end.setUTCHours(0, 0, 0, 0)

  let total = 0
  while (cursor < end) {
    const range = ranges.find((r) => {
      const from = new Date(r.dateFrom)
      const to = new Date(r.dateTo)
      return cursor >= from && cursor <= to
    })
    if (!range) return null
    total += round2(Number(range.pricePerNight))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return round2(total)
}

async function main() {
  const properties = await prisma.property.findMany({ select: { id: true, name: true } })

  let wouldChange = 0
  let protectedCount = 0

  for (const p of properties) {
    // Same filter as the real function.
    const candidates = await prisma.booking.findMany({
      where: { propertyId: p.id, hasCustomPrice: false },
    })
    const skipped = await prisma.booking.count({
      where: { propertyId: p.id, hasCustomPrice: true },
    })
    protectedCount += skipped

    const ranges = await prisma.priceRange.findMany({ where: { propertyId: p.id } })

    for (const b of candidates) {
      const roomTotal = computeRoomTotal(b.checkIn, b.checkOut, ranges)
      if (roomTotal === null) continue

      const extraBed = b.extraBedTotal ? Number(b.extraBedTotal) : 0
      const newTotal = round2(roomTotal + extraBed)
      const currentTotal = b.totalPrice ? Number(b.totalPrice) : 0
      if (Math.abs(currentTotal - newTotal) < 0.01) continue

      wouldChange++
      console.log(
        `  AT RISK  ${p.name.padEnd(12)} ${b.customerName.padEnd(34)} ${b.checkIn
          .toISOString()
          .slice(0, 10)} -> ${b.checkOut.toISOString().slice(0, 10)}  ${currentTotal} would become ${newTotal}`
      )
    }
  }

  console.log(`\nprotected by hasCustomPrice: ${protectedCount}`)
  console.log(`would still be rewritten   : ${wouldChange}`)
}

main()
  .catch((e) => {
    console.error('Simulation FAILED:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
