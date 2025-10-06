import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create businesses
  const evaggelia = await prisma.business.upsert({
    where: { id: 'evaggelia-id' },
    update: {},
    create: {
      id: 'evaggelia-id',
      name: 'Evaggelia Rental Apartments',
      email: 'info@evaggelias-apts.com',
    },
  })

  const elegancia = await prisma.business.upsert({
    where: { id: 'elegancia-id' },
    update: {},
    create: {
      id: 'elegancia-id',
      name: 'Elegancia Luxury Villas',
      email: 'info@elegancialuxuryvillas.com',
    },
  })

  // Create properties for Evaggelia
  const evaggeliaProperties = ['Apartment 1', 'Apartment 2', 'Apartment 3', 'Apartment 4']
  for (const propName of evaggeliaProperties) {
    await prisma.property.upsert({
      where: { id: `evaggelia-${propName.toLowerCase().replace(' ', '-')}` },
      update: {},
      create: {
        id: `evaggelia-${propName.toLowerCase().replace(' ', '-')}`,
        businessId: evaggelia.id,
        name: propName,
      },
    })
  }

  // Create properties for Elegancia
  const eleganciaProperties = ['Villa 1', 'Villa 2', 'Villa 3']
  for (const propName of eleganciaProperties) {
    await prisma.property.upsert({
      where: { id: `elegancia-${propName.toLowerCase().replace(' ', '-')}` },
      update: {},
      create: {
        id: `elegancia-${propName.toLowerCase().replace(' ', '-')}`,
        businessId: elegancia.id,
        name: propName,
      },
    })
  }

  // Create email templates for Evaggelia
  const evaggeliaTemplates = [
    {
      name: 'no_availability',
      subject: 'No Availability for Your Requested Dates',
      body: `Thank you very much for your interest in staying with us.

Unfortunately, there is no availability for the dates you requested.

We hope to have the pleasure of hosting you on another occasion.

Best regards,
Evaggelia Rental Apartments`,
    },
    {
      name: 'alternative_dates',
      subject: 'Alternative Dates for Your Stay',
      body: `Thank you for your request.

Unfortunately, we are fully booked for your selected dates, but we can accommodate you on the following available dates:

{{ALTERNATIVE_DATES}}

Please let us know if any of these periods work for you.

Best regards,
Evaggelia Rental Apartments`,
    },
    {
      name: 'availability_confirmation',
      subject: 'Availability for Your Requested Dates',
      body: `Thank you for your inquiry.

We are pleased to confirm that the dates you requested are available.

Please let us know if you would like to proceed with your booking.

Best regards,
Evaggelia Rental Apartments`,
    },
    {
      name: 'booking_confirmation',
      subject: 'Booking Confirmation',
      body: `Thank you very much for your booking.

Your stay has been confirmed for the following dates: {{CHECK_IN}} to {{CHECK_OUT}}.

{{PAYMENT_INFO}}

Once the payment is completed, please send us the transfer confirmation.

Best regards,
Evaggelia Rental Apartments`,
    },
  ]

  for (const template of evaggeliaTemplates) {
    await prisma.emailTemplate.upsert({
      where: { id: `evaggelia-${template.name}` },
      update: {},
      create: {
        id: `evaggelia-${template.name}`,
        businessId: evaggelia.id,
        ...template,
      },
    })
  }

  // Create email templates for Elegancia
  const eleganciaTemplates = [
    {
      name: 'no_availability',
      subject: 'No Availability for Your Requested Dates',
      body: `Thank you very much for your interest in staying with us.

Unfortunately, there is no availability for the dates you requested.

We hope to have the pleasure of hosting you on another occasion.

Best regards,
Elegancia Luxury Villas`,
    },
    {
      name: 'alternative_dates',
      subject: 'Alternative Dates for Your Stay',
      body: `Thank you for your request.

Unfortunately, we are fully booked for your selected dates, but we can accommodate you on the following available dates:

{{ALTERNATIVE_DATES}}

Please let us know if any of these periods work for you.

Best regards,
Elegancia Luxury Villas`,
    },
    {
      name: 'availability_confirmation',
      subject: 'Availability for Your Requested Dates',
      body: `Thank you for your inquiry.

We are pleased to confirm that the dates you requested are available.

Please let us know if you would like to proceed with your booking.

Best regards,
Elegancia Luxury Villas`,
    },
    {
      name: 'booking_confirmation',
      subject: 'Booking Confirmation',
      body: `Thank you very much for your booking.

Your stay has been confirmed for the following dates: {{CHECK_IN}} to {{CHECK_OUT}}.

{{PAYMENT_INFO}}

Once the payment is completed, please send us the transfer confirmation.

Best regards,
Elegancia Luxury Villas`,
    },
  ]

  for (const template of eleganciaTemplates) {
    await prisma.emailTemplate.upsert({
      where: { id: `elegancia-${template.name}` },
      update: {},
      create: {
        id: `elegancia-${template.name}`,
        businessId: elegancia.id,
        ...template,
      },
    })
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
