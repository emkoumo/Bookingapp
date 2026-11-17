/**
 * Write the quick-reply texts (English + Greek) into a hotel's four email
 * templates, and set what the hotel's units are called (apartment / villa).
 * Only those template subject/body fields and Business.unitType change.
 *
 * Dry run by default — prints what would change. To write:
 *   npx tsx scripts/set-quick-replies.ts evaggelia --apply
 *   npx tsx scripts/set-quick-replies.ts elegancia --apply
 * The current texts are saved to backups/ first, so they can be put back.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'

interface Texts {
  subject: string
  body: string
  subjectEl: string
  bodyEl: string
}

interface Hotel {
  businessId: string
  unitType: 'apartment' | 'villa'
  texts: Record<string, Texts>
}

/**
 * The four replies, written once and filled per hotel. `unitsEn`/`unitsEl`
 * head the booked units in the payment reply ("APARTMENTS" / "VILLAS").
 */
function replies(h: {
  brand: string
  // Greek article for the brand: στα/τα (Apartments) or στις/τις (villas).
  inEl: string
  theEl: string
  amenitiesEn: string
  amenitiesEl: string
  unitsEn: string
  unitsEl: string
}): Record<string, Texts> {
  const signEn = `Warm regards,\n${h.brand}`
  const signEl = `Με εκτίμηση,\n${h.brand}`
  return {
    availability_confirmation: {
      subject: 'Availability for Your Requested Dates',
      body: `AVAILABILITY FOR YOUR REQUESTED DATES

Thank you for your inquiry! We're happy to confirm that your requested dates are available at ${h.brand}.

DATES
{{DATES}}

PRICE
{{PRICE}}

${h.amenitiesEn}

Please let us know if you'd like to proceed with your booking, and we'll hold the dates for you.

We look forward to hosting you!

${signEn}`,
      subjectEl: 'Διαθεσιμότητα για τις ημερομηνίες σας',
      bodyEl: `ΔΙΑΘΕΣΙΜΟΤΗΤΑ ΓΙΑ ΤΙΣ ΗΜΕΡΟΜΗΝΙΕΣ ΣΑΣ

Σας ευχαριστούμε για το ενδιαφέρον σας! Με χαρά σας επιβεβαιώνουμε ότι οι ημερομηνίες που ζητήσατε είναι διαθέσιμες ${h.inEl} ${h.brand}.

ΗΜΕΡΟΜΗΝΙΕΣ
{{DATES}}

ΤΙΜΗ
{{PRICE}}

${h.amenitiesEl}

Ενημερώστε μας αν θέλετε να προχωρήσετε σε κράτηση και θα κρατήσουμε τις ημερομηνίες για εσάς.

Ανυπομονούμε να σας φιλοξενήσουμε!

${signEl}`,
    },

    alternative_dates: {
      subject: 'Alternative Dates for Your Stay',
      body: `ALTERNATIVE DATES FOR YOUR STAY

Thank you very much for your interest in staying with us at ${h.brand}.

Unfortunately, we are fully booked for your requested dates. However, we would be delighted to welcome you on the following alternative dates:

{{ALTERNATIVE_DATES}}

${h.amenitiesEn}

Please let us know if any of these options suit your plans, and we'll be happy to assist you with the booking.

${signEn}`,
      subjectEl: 'Εναλλακτικές ημερομηνίες για τη διαμονή σας',
      bodyEl: `ΕΝΑΛΛΑΚΤΙΚΕΣ ΗΜΕΡΟΜΗΝΙΕΣ ΓΙΑ ΤΗ ΔΙΑΜΟΝΗ ΣΑΣ

Σας ευχαριστούμε πολύ για το ενδιαφέρον σας για ${h.theEl} ${h.brand}.

Δυστυχώς, για τις ημερομηνίες που ζητήσατε είμαστε πλήρεις. Θα χαρούμε όμως πολύ να σας φιλοξενήσουμε τις παρακάτω εναλλακτικές ημερομηνίες:

{{ALTERNATIVE_DATES}}

${h.amenitiesEl}

Ενημερώστε μας αν σας εξυπηρετεί κάποια από αυτές τις επιλογές και θα χαρούμε να σας βοηθήσουμε με την κράτηση.

${signEl}`,
    },

    booking_confirmation: {
      subject: 'Booking Confirmation',
      body: `BOOKING CONFIRMATION

Thank you very much for your booking! We are delighted to confirm your stay at ${h.brand}.

DATES
{{DATES}}

${h.unitsEn}
{{APARTMENTS}}

PRICE
{{PRICE}}

PAYMENT
To finalize your reservation, an advance payment is required:

{{PAYMENT_INFO}}

Once your transfer is complete, kindly send us the payment confirmation so that we can secure your booking.

We look forward to welcoming you!

${signEn}`,
      subjectEl: 'Επιβεβαίωση κράτησης',
      bodyEl: `ΕΠΙΒΕΒΑΙΩΣΗ ΚΡΑΤΗΣΗΣ

Σας ευχαριστούμε πολύ για την κράτησή σας! Με χαρά επιβεβαιώνουμε τη διαμονή σας ${h.inEl} ${h.brand}.

ΗΜΕΡΟΜΗΝΙΕΣ
{{DATES}}

${h.unitsEl}
{{APARTMENTS}}

ΤΙΜΗ
{{PRICE}}

ΠΛΗΡΩΜΗ
Για την ολοκλήρωση της κράτησης απαιτείται προκαταβολή:

{{PAYMENT_INFO}}

Μόλις ολοκληρώσετε τη μεταφορά, παρακαλούμε στείλτε μας το αποδεικτικό πληρωμής ώστε να οριστικοποιηθεί η κράτησή σας.

Ανυπομονούμε να σας καλωσορίσουμε!

${signEl}`,
    },

    no_availability: {
      subject: 'No Availability for Your Requested Dates',
      body: `NO AVAILABILITY

Thank you very much for your interest in staying with us.

Unfortunately, there is no availability for the dates you requested.

We hope to have the pleasure of hosting you on another occasion.

${signEn}`,
      subjectEl: 'Μη διαθεσιμότητα',
      bodyEl: `ΜΗ ΔΙΑΘΕΣΙΜΟΤΗΤΑ

Σας ευχαριστούμε πολύ για το ενδιαφέρον σας.

Δυστυχώς, δεν υπάρχει διαθεσιμότητα για τις ημερομηνίες που ζητήσατε.

Ελπίζουμε να έχουμε τη χαρά να σας φιλοξενήσουμε σε μια άλλη ευκαιρία.

${signEl}`,
    },
  }
}

const HOTELS: Record<string, Hotel> = {
  evaggelia: {
    businessId: 'evaggelia-id',
    unitType: 'apartment',
    texts: replies({
      brand: 'Evaggelia Rental Apartments',
      inEl: 'στα',
      theEl: 'τα',
      unitsEn: 'APARTMENTS',
      unitsEl: 'ΔΙΑΜΕΡΙΣΜΑΤΑ',
      amenitiesEn: `APARTMENT AMENITIES
- 2 semi-double beds (1.20m each)
- Extra single bed or baby playpen available (+5€/day)
- Fully equipped kitchen
- Private bathroom
- Private parking
- Big garden
- BBQ
- Shared washing machine`,
      amenitiesEl: `ΠΑΡΟΧΕΣ ΔΙΑΜΕΡΙΣΜΑΤΟΣ
- 2 ημίδιπλα κρεβάτια (1,20μ. το καθένα)
- Επιπλέον μονό κρεβάτι ή παρκοκρέβατο μωρού (+5€/ημέρα)
- Πλήρως εξοπλισμένη κουζίνα
- Ιδιωτικό μπάνιο
- Ιδιωτικό πάρκινγκ
- Μεγάλος κήπος
- BBQ
- Κοινόχρηστο πλυντήριο ρούχων`,
    }),
  },

  // Amenities from elegancialuxuryvillas.com (November 2026).
  elegancia: {
    businessId: 'elegancia-id',
    unitType: 'villa',
    texts: replies({
      brand: 'Elegancia luxury villas',
      inEl: 'στις',
      theEl: 'τις',
      unitsEn: 'VILLAS',
      unitsEl: 'ΒΙΛΕΣ',
      amenitiesEn: `VILLA AMENITIES
- 2 master bedrooms and 2 bathrooms
- Up to 6 guests
- Private pool and private hot tub
- Private garden with sun loungers, BBQ and outdoor dining
- Fully equipped kitchen with espresso machine
- Air conditioning throughout and high-speed Wi-Fi
- Smart TVs and sofa bed in the living room
- Washing machine and iron
- Free private parking
- Baby cot on request

Check-in 15:00 – 22:00 (self check-in), check-out by 11:00.`,
      amenitiesEl: `ΠΑΡΟΧΕΣ ΒΙΛΑΣ
- 2 κύρια υπνοδωμάτια και 2 μπάνια
- Έως 6 άτομα
- Ιδιωτική πισίνα και ιδιωτικό υδρομασάζ (hot tub)
- Ιδιωτικός κήπος με ξαπλώστρες, BBQ και τραπεζαρία εξωτερικού χώρου
- Πλήρως εξοπλισμένη κουζίνα με μηχανή espresso
- Κλιματισμός σε όλους τους χώρους και γρήγορο Wi-Fi
- Smart TV και καναπές-κρεβάτι στο σαλόνι
- Πλυντήριο ρούχων και σίδερο
- Δωρεάν ιδιωτικό πάρκινγκ
- Βρεφικό κρεβάτι κατόπιν αιτήματος

Check-in 15:00 – 22:00 (αυτόνομο check-in), check-out έως 11:00.`,
    }),
  },
}

async function main() {
  const key = process.argv[2]
  const apply = process.argv.includes('--apply')
  const hotel = HOTELS[key]
  if (!hotel) throw new Error(`Usage: set-quick-replies.ts <${Object.keys(HOTELS).join('|')}> [--apply]`)

  const business = await prisma.business.findUnique({ where: { id: hotel.businessId } })
  if (!business) throw new Error(`No business with id ${hotel.businessId}`)
  const rows = await prisma.emailTemplate.findMany({ where: { businessId: hotel.businessId } })

  const missing = Object.keys(hotel.texts).filter((name) => !rows.some((r) => r.name === name))
  if (missing.length > 0) throw new Error(`${business.name} has no template named: ${missing.join(', ')}`)

  const verb = apply ? 'Updating' : 'Would update'
  console.log(`${business.name}: ${verb} unitType ${business.unitType} -> ${hotel.unitType}`)
  for (const row of rows) if (hotel.texts[row.name]) console.log(`${business.name}: ${verb} template ${row.name}`)
  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to write.')
    return
  }

  const dir = join(process.cwd(), 'backups')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = join(dir, `${key}-templates-before-${stamp}.json`)
  writeFileSync(file, JSON.stringify({ business, templates: rows }, null, 2), 'utf8')
  console.log(`Previous texts saved: ${file}`)

  await prisma.$transaction([
    prisma.business.update({ where: { id: hotel.businessId }, data: { unitType: hotel.unitType } }),
    ...rows
      .filter((row) => hotel.texts[row.name])
      .map((row) => prisma.emailTemplate.update({ where: { id: row.id }, data: hotel.texts[row.name] })),
  ])
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error('FAILED:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
