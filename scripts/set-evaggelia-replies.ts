/**
 * Write Evaggelia's quick-reply texts (English + Greek) into its four email
 * templates. Only the subject/body fields of those four rows change.
 *
 * Dry run by default — prints what would change. To write:
 *   npx tsx scripts/set-evaggelia-replies.ts --apply
 * The current texts are saved to backups/ first, so they can be put back.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'

const BUSINESS_ID = 'evaggelia-id'
const SIGN_EN = 'Warm regards,\nEvaggelia Rental Apartments'
const SIGN_EL = 'Με εκτίμηση,\nEvaggelia Rental Apartments'

const AMENITIES_EN = `APARTMENT AMENITIES
- 2 semi-double beds (1.20m each)
- Extra single bed or baby playpen available (+5€/day)
- Fully equipped kitchen
- Private bathroom
- Private parking
- Big garden
- BBQ
- Shared washing machine`

const AMENITIES_EL = `ΠΑΡΟΧΕΣ ΔΙΑΜΕΡΙΣΜΑΤΟΣ
- 2 ημίδιπλα κρεβάτια (1,20μ. το καθένα)
- Επιπλέον μονό κρεβάτι ή παρκοκρέβατο μωρού (+5€/ημέρα)
- Πλήρως εξοπλισμένη κουζίνα
- Ιδιωτικό μπάνιο
- Ιδιωτικό πάρκινγκ
- Μεγάλος κήπος
- BBQ
- Κοινόχρηστο πλυντήριο ρούχων`

const TEXTS: Record<string, { subject: string; body: string; subjectEl: string; bodyEl: string }> = {
  availability_confirmation: {
    subject: 'Availability for Your Requested Dates',
    body: `AVAILABILITY FOR YOUR REQUESTED DATES

Thank you for your inquiry! We're happy to confirm that your requested dates are available at Evaggelia Rental Apartments.

DATES
{{DATES}}

PRICE
{{PRICE}}

${AMENITIES_EN}

Please let us know if you'd like to proceed with your booking, and we'll hold the dates for you.

We look forward to hosting you!

${SIGN_EN}`,
    subjectEl: 'Διαθεσιμότητα για τις ημερομηνίες σας',
    bodyEl: `ΔΙΑΘΕΣΙΜΟΤΗΤΑ ΓΙΑ ΤΙΣ ΗΜΕΡΟΜΗΝΙΕΣ ΣΑΣ

Σας ευχαριστούμε για το ενδιαφέρον σας! Με χαρά σας επιβεβαιώνουμε ότι οι ημερομηνίες που ζητήσατε είναι διαθέσιμες στα Evaggelia Rental Apartments.

ΗΜΕΡΟΜΗΝΙΕΣ
{{DATES}}

ΤΙΜΗ
{{PRICE}}

${AMENITIES_EL}

Ενημερώστε μας αν θέλετε να προχωρήσετε σε κράτηση και θα κρατήσουμε τις ημερομηνίες για εσάς.

Ανυπομονούμε να σας φιλοξενήσουμε!

${SIGN_EL}`,
  },

  alternative_dates: {
    subject: 'Alternative Dates for Your Stay',
    body: `ALTERNATIVE DATES FOR YOUR STAY

Thank you very much for your interest in staying with us at Evaggelia Rental Apartments.

Unfortunately, we are fully booked for your requested dates. However, we would be delighted to welcome you on the following alternative dates:

{{ALTERNATIVE_DATES}}

${AMENITIES_EN}

Please let us know if any of these options suit your plans, and we'll be happy to assist you with the booking.

${SIGN_EN}`,
    subjectEl: 'Εναλλακτικές ημερομηνίες για τη διαμονή σας',
    bodyEl: `ΕΝΑΛΛΑΚΤΙΚΕΣ ΗΜΕΡΟΜΗΝΙΕΣ ΓΙΑ ΤΗ ΔΙΑΜΟΝΗ ΣΑΣ

Σας ευχαριστούμε πολύ για το ενδιαφέρον σας για τα Evaggelia Rental Apartments.

Δυστυχώς, για τις ημερομηνίες που ζητήσατε είμαστε πλήρεις. Θα χαρούμε όμως πολύ να σας φιλοξενήσουμε τις παρακάτω εναλλακτικές ημερομηνίες:

{{ALTERNATIVE_DATES}}

${AMENITIES_EL}

Ενημερώστε μας αν σας εξυπηρετεί κάποια από αυτές τις επιλογές και θα χαρούμε να σας βοηθήσουμε με την κράτηση.

${SIGN_EL}`,
  },

  booking_confirmation: {
    subject: 'Booking Confirmation',
    body: `BOOKING CONFIRMATION

Thank you very much for your booking! We are delighted to confirm your stay at Evaggelia Rental Apartments.

DATES
{{DATES}}

APARTMENTS
{{APARTMENTS}}

PRICE
{{PRICE}}

PAYMENT
To finalize your reservation, an advance payment is required:

{{PAYMENT_INFO}}

Once your transfer is complete, kindly send us the payment confirmation so that we can secure your booking.

We look forward to welcoming you!

${SIGN_EN}`,
    subjectEl: 'Επιβεβαίωση κράτησης',
    bodyEl: `ΕΠΙΒΕΒΑΙΩΣΗ ΚΡΑΤΗΣΗΣ

Σας ευχαριστούμε πολύ για την κράτησή σας! Με χαρά επιβεβαιώνουμε τη διαμονή σας στα Evaggelia Rental Apartments.

ΗΜΕΡΟΜΗΝΙΕΣ
{{DATES}}

ΔΙΑΜΕΡΙΣΜΑΤΑ
{{APARTMENTS}}

ΤΙΜΗ
{{PRICE}}

ΠΛΗΡΩΜΗ
Για την ολοκλήρωση της κράτησης απαιτείται προκαταβολή:

{{PAYMENT_INFO}}

Μόλις ολοκληρώσετε τη μεταφορά, παρακαλούμε στείλτε μας το αποδεικτικό πληρωμής ώστε να οριστικοποιηθεί η κράτησή σας.

Ανυπομονούμε να σας καλωσορίσουμε!

${SIGN_EL}`,
  },

  no_availability: {
    subject: 'No Availability for Your Requested Dates',
    body: `NO AVAILABILITY

Thank you very much for your interest in staying with us.

Unfortunately, there is no availability for the dates you requested.

We hope to have the pleasure of hosting you on another occasion.

${SIGN_EN}`,
    subjectEl: 'Μη διαθεσιμότητα',
    bodyEl: `ΜΗ ΔΙΑΘΕΣΙΜΟΤΗΤΑ

Σας ευχαριστούμε πολύ για το ενδιαφέρον σας.

Δυστυχώς, δεν υπάρχει διαθεσιμότητα για τις ημερομηνίες που ζητήσατε.

Ελπίζουμε να έχουμε τη χαρά να σας φιλοξενήσουμε σε μια άλλη ευκαιρία.

${SIGN_EL}`,
  },
}

async function main() {
  const apply = process.argv.includes('--apply')
  const rows = await prisma.emailTemplate.findMany({ where: { businessId: BUSINESS_ID } })

  const missing = Object.keys(TEXTS).filter((name) => !rows.some((r) => r.name === name))
  if (missing.length > 0) throw new Error(`Evaggelia has no template named: ${missing.join(', ')}`)

  for (const row of rows) {
    if (TEXTS[row.name]) console.log(`${apply ? 'Updating' : 'Would update'}: ${row.name}`)
  }
  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to write.')
    return
  }

  const dir = join(process.cwd(), 'backups')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = join(dir, `evaggelia-templates-before-${stamp}.json`)
  writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8')
  console.log(`Previous texts saved: ${file}`)

  await prisma.$transaction(
    rows
      .filter((row) => TEXTS[row.name])
      .map((row) => prisma.emailTemplate.update({ where: { id: row.id }, data: TEXTS[row.name] }))
  )
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error('FAILED:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
