import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      businessId,
      templateName,
      recipientEmail,
      recipientName,
      alternativeDates,
      checkIn,
      checkOut,
      paymentMethod, // 'bank' or 'western_union'
    } = body

    if (!businessId || !templateName || !recipientEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Fetch business and template
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const template = await prisma.emailTemplate.findFirst({
      where: {
        businessId,
        name: templateName,
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Process template placeholders
    let emailBody = template.body

    if (recipientName) {
      emailBody = emailBody.replace(/{{CUSTOMER_NAME}}/g, recipientName)
    }

    if (alternativeDates && Array.isArray(alternativeDates)) {
      const datesText = alternativeDates
        .map((range) => `• ${range.start} to ${range.end}`)
        .join('\n')
      emailBody = emailBody.replace(/{{ALTERNATIVE_DATES}}/g, datesText)
    }

    if (checkIn) {
      emailBody = emailBody.replace(
        /{{CHECK_IN}}/g,
        format(new Date(checkIn), 'dd/MM/yyyy')
      )
    }

    if (checkOut) {
      emailBody = emailBody.replace(
        /{{CHECK_OUT}}/g,
        format(new Date(checkOut), 'dd/MM/yyyy')
      )
    }

    // Payment info
    if (paymentMethod === 'bank') {
      const bankInfo = `Please make a deposit via Bank Transfer:

Bank: ${process.env[`${businessId.toUpperCase().replace(/-/g, '_')}_BANK_NAME`] || 'Bank Name'}
IBAN: ${process.env[`${businessId.toUpperCase().replace(/-/g, '_')}_IBAN`] || 'IBAN'}
Account Holder: ${process.env[`${businessId.toUpperCase().replace(/-/g, '_')}_ACCOUNT_HOLDER`] || 'Account Holder'}`

      emailBody = emailBody.replace(/{{PAYMENT_INFO}}/g, bankInfo)
    } else if (paymentMethod === 'western_union') {
      const wuInfo = `Please make a deposit via Western Union:

Recipient Name: ${process.env[`${businessId.toUpperCase().replace(/-/g, '_')}_WU_RECIPIENT`] || 'Recipient Name'}
City: ${process.env[`${businessId.toUpperCase().replace(/-/g, '_')}_WU_CITY`] || 'City'}
Country: ${process.env[`${businessId.toUpperCase().replace(/-/g, '_')}_WU_COUNTRY`] || 'Country'}`

      emailBody = emailBody.replace(/{{PAYMENT_INFO}}/g, wuInfo)
    } else {
      emailBody = emailBody.replace(/{{PAYMENT_INFO}}/g, '')
    }

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    })

    // Send email
    const info = await transporter.sendMail({
      from: business.email,
      to: recipientEmail,
      subject: template.subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>'),
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully',
    })
  } catch (error) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: 'Failed to send email', details: (error as Error).message },
      { status: 500 }
    )
  }
}
