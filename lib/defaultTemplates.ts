export function defaultEmailTemplates(businessName: string) {
  return [
    {
      name: 'no_availability',
      subject: 'No Availability for Your Requested Dates',
      body: `Thank you very much for your interest in staying with us.

Unfortunately, there is no availability for the dates you requested.

We hope to have the pleasure of hosting you on another occasion.

Best regards,
${businessName}`,
    },
    {
      name: 'alternative_dates',
      subject: 'Alternative Dates for Your Stay',
      body: `Thank you for your request.

Unfortunately, we are fully booked for your selected dates, but we can accommodate you on the following available dates:

{{ALTERNATIVE_DATES}}

Please let us know if any of these periods work for you.

Best regards,
${businessName}`,
    },
    {
      name: 'availability_confirmation',
      subject: 'Availability for Your Requested Dates',
      body: `Thank you for your inquiry.

We are pleased to confirm that the dates you requested are available.

Please let us know if you would like to proceed with your booking.

Best regards,
${businessName}`,
    },
    {
      name: 'booking_confirmation',
      subject: 'Booking Confirmation',
      body: `Thank you very much for your booking.

Your stay has been confirmed for the following dates: {{CHECK_IN}} to {{CHECK_OUT}}.

{{PAYMENT_INFO}}

Once the payment is completed, please send us the transfer confirmation.

Best regards,
${businessName}`,
    },
  ]
}
