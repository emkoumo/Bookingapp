import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding email templates...')

  // Get all businesses
  const businesses = await prisma.business.findMany()

  for (const business of businesses) {
    console.log(`Seeding templates for ${business.name}...`)

    // Check if templates already exist
    const existingTemplates = await prisma.emailTemplate.findMany({
      where: { businessId: business.id },
    })

    if (existingTemplates.length > 0) {
      console.log(`  Templates already exist for ${business.name}, skipping...`)
      continue
    }

    // Create default templates
    const templates = [
      {
        businessId: business.id,
        name: 'no_availability',
        subject: 'Thank you for your inquiry',
        body: `Dear Guest,

Thank you for your interest in our properties.

Unfortunately, we are fully booked for your selected dates.

We appreciate your understanding and hope to accommodate you in the future.

Best regards,
${business.name}`,
      },
      {
        businessId: business.id,
        name: 'alternative_dates',
        subject: 'Alternative dates available',
        body: `Dear Guest,

Thank you for your request.

Unfortunately, we are fully booked for your selected dates, but we can accommodate you on the following available dates:

{{ALTERNATIVE_DATES}}

Please let us know if any of these periods work for you.

Best regards,
${business.name}`,
      },
      {
        businessId: business.id,
        name: 'availability_confirmation',
        subject: 'Availability confirmed for your dates',
        body: `Dear Guest,

Thank you for your inquiry.

We are pleased to confirm availability for your requested dates.

Please let us know if you would like to proceed with the booking.

Best regards,
${business.name}`,
      },
      {
        businessId: business.id,
        name: 'booking_confirmation',
        subject: 'Booking confirmation',
        body: `Dear Guest,

Thank you for your booking!

Your reservation has been confirmed.

Check-in: {{CHECK_IN}}
Check-out: {{CHECK_OUT}}

We look forward to welcoming you!

Best regards,
${business.name}`,
      },
    ]

    await prisma.emailTemplate.createMany({
      data: templates,
    })

    console.log(`  Created ${templates.length} templates for ${business.name}`)
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
